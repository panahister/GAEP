# State Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PLT-018  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Cross-platform state-machine specification

## Purpose

This document defines explicit state across GAEP. Reliable governance and automation require the platform to know what exists, what is approved, what is changing, what is allowed next, and who may cause the transition.

## State Dimensions

GAEP maintains related but independent state dimensions:

1. Engineering Initiative lifecycle state, including a Product lifecycle profile when applicable;
2. package/workstream state;
3. artifact state;
4. change state;
5. approval state;
6. agent run state;
7. evidence state;
8. integration or operational state where required.

No single `status` field can safely represent all dimensions.

## State Record

Every governed state record includes:

- entity ID and state dimension;
- current state and version;
- previous state;
- transition event and reason;
- actor and exercised role;
- timestamp;
- applicable policy and approval;
- required and produced evidence;
- conditions or expiration;
- correlation to change and run.

## Product Lifecycle Profile States

The following states apply when the Engineering Initiative is classified as a Product and the Product Lifecycle profile is selected. They are not the universal lifecycle for services, defects, migrations, infrastructure, libraries, security remediation, or other initiative types.

The lifecycle is iterative; states represent current governance readiness, not a prohibition on learning.

| State | Meaning |
|---|---|
| `initiated` | Product intent exists; ownership and discovery are starting. |
| `discovery` | Problem, stakeholders, scope, constraints, and glossary are being established. |
| `business_architecture` | Capabilities, value streams, outcomes, and business context are modeled. |
| `product_architecture` | Domains, modules, actors, roles, authorization, and boundaries are defined. |
| `process_data_event` | Processes, rules, conceptual data, events, and integrations are defined. |
| `experience_design` | Journeys, UX, design system, wireframes, prototypes, and accessibility are shaped. |
| `backlog_ready` | Epics, features, stories, acceptance criteria, and mappings are baselined sufficiently. |
| `solution_architecture` | Implementation architecture, contracts, and quality attributes are approved. |
| `implementation` | Governed code and engineering assets are being built. |
| `verification` | Integrated quality, security, and acceptance evidence are evaluated. |
| `release_ready` | Release package and approvals are complete. |
| `operational` | Product version is running and monitored. |
| `evolving` | Controlled changes are active against an operational or baselined product. |
| `retired` | Product is no longer active; retention and closure obligations remain. |

Organizations may tailor profiles, but must map local stages to these semantics.

## Lifecycle Transition Contract

A transition declares:

- source and target state;
- entry and exit criteria;
- required artifact baselines;
- unresolved-risk thresholds;
- required reviews and approver;
- evidence package;
- commands enabled or disabled;
- rollback or reopening behavior.

Progression does not require every possible artifact. It requires the right evidence for the initiative's risk and selected lifecycle profile.

## Artifact States

`proposed → draft → challenged → revised → in_review → awaiting_approval → approved → baseline → superseded → retired`

Additional states:

- `rejected` — reviewed and not accepted;
- `withdrawn` — author intentionally removed proposal;
- `invalidated` — previously usable artifact is no longer reliable due to a known event.

Rules:

- `approved` indicates acceptance; `baseline` indicates current authoritative use.
- An artifact cannot approve itself or inherit approval from a parent folder.
- Supersession identifies the replacement.
- Editing a baseline creates a new draft or change version.

## Change States

`requested → triaged → analyzing → designed → awaiting_approval → approved → implementing → validating → completed → closed`

Alternative states:

- `rejected`;
- `deferred`;
- `cancelled`;
- `blocked`;
- `rolled_back`;
- `partially_completed`.

Approval is scoped to the analyzed change. Material scope expansion returns the change to analysis and approval.

## Approval States

`not_required`, `required`, `requested`, `in_review`, `approved`, `conditionally_approved`, `changes_required`, `rejected`, `expired`, `revoked`.

An approval record is independent of artifact status. Artifact state transitions may consume a valid approval but must not overwrite the approval history.

## Run States

`requested → resolving → authorizing → contextualizing → planning → ready → executing → validating → awaiting_human → committing → completed`

Alternative states:

`blocked`, `denied`, `failed`, `cancelled`, `partial`, `rolled_back`.

A resumed run must revalidate mutable preconditions.

## Evidence States

- `expected` — required but not yet produced;
- `collected` — captured but not validated;
- `validated` — integrity and relevance confirmed;
- `accepted` — reviewer or policy accepted evidence for a defined claim;
- `expired` — no longer current enough;
- `invalidated` — known to be unreliable;
- `retained` — stored for audit or learning after active use.

## Composite State

The platform derives an operational view from multiple state dimensions. Example:

```yaml
product_lifecycle: solution_architecture
active_package: PKG-ARCH-01
target_artifact:
  id: GAEP-ARCH-042
  state: in_review
active_change:
  id: CHG-2026-0031
  state: awaiting_approval
approval:
  state: requested
run:
  id: RUN-2026-4811
  state: awaiting_human
```

This is more accurate than reporting the product simply as `in progress`.

## Transition Invariants

- Current state must be read before a transition.
- Transition actor and authority must be attributable.
- Preconditions must be evaluated against explicit versions.
- Required approval must be valid, scoped, and unexpired.
- Required evidence must be linked and accepted.
- A transition must be idempotent or reject duplicates safely.
- Concurrent conflicting transitions must be serialized or rejected.
- Transition history is append-only in meaning.
- AI may recommend a transition but cannot provide required human approval.

## Optimistic Concurrency

State-changing operations should declare the expected current version. If state changed since context assembly or approval, the operation stops for revalidation rather than applying a stale decision.

## Reopening and Regression

Discoveries may require returning to an earlier lifecycle state. This is governed evolution, not failure.

A regression transition records:

- triggering evidence;
- affected baselines;
- impact and risk;
- work that remains valid;
- required re-approval;
- downstream invalidation or suspension.

## State Profiles

Organizations may define lifecycle profiles such as lightweight, standard, regulated, or experimental. A profile may:

- combine or expand stages;
- change gate criteria and approver roles;
- require additional evidence;
- restrict commands and integrations.

Profiles cannot remove constitutional accountability, provenance, or controlled-change requirements.

## Engineering Resolution State

Consequential engineering subjects may progress through **Proposed**, **Challenged**, **Resolved**, **Approved**, **Implemented**, and **Verified** states. These are resolution semantics rather than one mandatory linear lifecycle. A subject may return from Approved or Implemented to Challenged when new evidence or change invalidates its assumptions.

GAEP shall maintain separate state records for:

- Applicability Decisions and Challenge Records;
- Test Methodology Decisions, Test Case definition, automation, and execution;
- Architecture Decisions, Architecture Assets, HLD, LLD, and conformance;
- Authentication Profile and Authorization Model;
- Assurance Profiles, Coverage Targets, Test Evidence, and Quality Gates;
- Boilerplate Bindings, exceptions, Implementation Readiness, and Change Impact.

Architecture and assurance freshness is orthogonal to approval. Assets may be **Current**, **Potentially Stale**, **Stale**, **Invalidated**, or **Superseded**. An Approved artifact that becomes Stale must not guide new implementation until impact is resolved. Test Cases likewise separate Draft/Challenged/Revised/Approved definition state from Not Automated/Partially Automated/Automated and Not Executed/Passed/Failed/Blocked execution state.

These state dimensions are defined in detail by the [Dynamic Engineering Model](019_DYNAMIC_ENGINEERING_MODEL.md) and [Engineering Assurance and Architecture Model](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Queries the State Model Must Answer

- What is the Engineering Initiative's current governance stage and selected lifecycle profile?
- Which artifact version is authoritative?
- What changes are active and what do they affect?
- Which approvals are missing, conditional, expired, or revoked?
- What evidence is expected or stale?
- What actions are allowed now for this actor?
- What is blocking progress?
- What changed since the context pack was assembled?
- What are the next valid transitions?

## Design Implications

This state model directly controls:

- [Product Lifecycle](../03_Product_Engineering/021_PRODUCT_LIFECYCLE.md)
- [Artifact Lifecycle](../03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md)
- [Change Management](../03_Product_Engineering/023_CHANGE_MANAGEMENT.md)
- [Human Approval Model](../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md)
- [Agent Execution Flow](../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md)
- [Stop Conditions](../05_AI_Runtime/045_STOP_CONDITIONS.md)
- [Dynamic Engineering Model](019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
