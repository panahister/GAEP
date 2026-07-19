---
id: GAEP-CORE-006
title: Decision, Review, Approval, and Authorization Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Decision and Authorization Steward
scope: Recommendations, accountable decisions, reviews, findings, approvals, confirmations, and executable authorization
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
  - GAEP-CORE-001
  - GAEP-CORE-002
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
core_package_interfaces:
  - GAEP-CORE-007
informative_references:
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md
  - ../../05_AI_Runtime/044_DECISION_MODEL.md
  - ../../05_AI_Runtime/045_STOP_CONDITIONS.md
supersedes: []
---

# Decision, Review, Approval, and Authorization Model

## Purpose

This document separates six frequently conflated interactions:

1. a Recommendation proposes an option;
2. a Decision selects or declines among options;
3. a Review governs accountable consideration of an exact subject and consumes one or more exact Evaluation Results or attributable contributions;
4. an Approval records accountable human acceptance or rejection for a declared purpose;
5. an Authorization Grant permits a defined action;
6. a Confirmation acknowledges an imminent action without silently replacing required approval.

Validation, file creation, merge, passing tests, review completion, model confidence, and policy evaluation do not become one another by implication.

## Conceptual boundary

This model owns:

- Recommendation and Decision Records;
- Review, Review Contribution, and Review Finding;
- Approval Requirement, Approval Case, Approval Response, and Approval Determination;
- Authorization Grants and action-time Confirmations;
- segregation, validity, reopening, revocation, and exact-subject binding.

This model does not own:

- policy-rule composition;
- evidence content and assessment methods;
- runtime user interface;
- cryptographic signature technology;
- organization-specific quorum rules;
- domain-specific gate criteria.

## Core entities

| Entity | Meaning |
|---|---|
| Recommendation | Advisory proposal identifying preferred option, rationale, evidence, assumptions, uncertainty, alternatives, and recommender. |
| Decision Question | Versioned, scoped question requiring accountable selection or disposition. |
| Decision Option | Addressable alternative with consequences, constraints, risks, and evidence. |
| Decision Record | Durable record of framing, authority, options, analysis, Decision Outcome, consequences, and review triggers. |
| Decision Outcome | Selected option, selected no-action option, deferred decision, rejected option set, or unresolved disposition. |
| Review | Governed decision-support activity for an exact subject that commissions or consumes Evaluation Results and attributable Review Contributions against declared criteria. Review is not the epistemic Evaluation procedure itself. |
| Review Contribution | Attributable assessment by one reviewer Principal and exercised role. |
| Review Finding | Addressable issue, observation, non-conformance, risk, or improvement identified through Review. |
| Review Conclusion | Governed output stating review completeness, sufficiency, limitations, unresolved findings, and recommendation after considering the bound Evaluation Results and Review Contributions. |
| Approval Requirement | Policy-derived declaration of which exact subject, approver roles, evidence, independence, quorum, and validity are required. |
| Approval Case | Version-bound request package collecting one or more Approval Responses under one Approval Requirement. |
| Approval Response | Attributable human response for one approver role and exact Approval Case revision. |
| Approval Determination | Effective aggregate result after applying required roles, quorum, conditions, conflicts, and policy. |
| Authorization Grant | Versioned permission allowing named Principals or role holders to perform defined actions on exact subjects within scope, time, uses, and conditions. |
| Confirmation | Attributable acknowledgement immediately before a defined action or effect. |
| Revocation | Attributable termination of a previously valid Approval Determination or Authorization Grant according to authority and policy. |

## Recommendation versus decision

A Recommendation has no decision authority. It may be human- or AI-produced. A Decision Record identifies:

- one clear Decision Question;
- owner and decision authority;
- scope and non-scope;
- exact context and evidence revisions;
- alternatives, including no action where meaningful;
- criteria and trade-offs;
- assumptions, uncertainty, dissent, and conflicts;
- Recommendation or Recommendations;
- Decision Outcome and selecting human where required;
- consequences, risks, Obligations, and implementation boundary;
- effective time, expiry, and review triggers;
- affected resources and relationships.

A human selection may still require specialist or governance Approval before action. Decision Outcome and Approval Determination are separate.

### Decision state dimensions

Decision authoring lifecycle:

- draft;
- proposed;
- in-review;
- finalized.

Decision Outcome:

- `option-selected`;
- `no-action-selected`;
- `deferred`;
- `option-set-rejected`;
- `unresolved`.

Decision effectiveness is a separate dimension: pending, effective, suspended, expired, or revoked. Revision disposition is separately candidate, current, withdrawn, or superseded. Operational eligibility is separately eligible, deprecated, or retired. Conditions and validity are also separate records or dimensions. Revising options after a decision creates a new Decision Record revision and may reopen approval; it does not rewrite the historical outcome.

## Review model

A Review identifies:

- exact subject revision, Candidate Revision Set revision, or existing Baseline Set designation;
- purpose, criteria, exclusions, and required reviewer competence;
- applicable policies, profiles, and evidence;
- exact Evaluation Results commissioned or consumed, including method and limitation references;
- Review Contributions;
- Review Findings;
- one Review Conclusion recording completeness, sufficiency, limitations, unresolved findings, and recommendation;
- relation to Approval Case or gate, if any.

Evaluation and Review have an explicit boundary. An Evaluation is an epistemic procedure and result governed by GAEP-CORE-007. A Review is a governance activity governed here: it decides which evaluations and contributions are sufficient for its declared criteria and records limitations, findings, conclusion, and recommendation. Evaluation completion never implies Review completion, approval, or permission. AI review is attributed to an Agent Principal and remains advisory unless a deterministic criterion is explicitly authoritative under policy.

### Review Finding

A Review Finding contains:

- finding ID and revision;
- exact subject and location or semantic element;
- category, severity, and confidence under declared registries;
- requirement, criterion, evidence, and rationale;
- potential consequence and affected scope;
- owner and due condition;
- disposition and verification;
- exception or accepted-risk reference where applicable.

Review Finding is the review-origin specialization of the shared Finding concept. Evaluation- and gate-origin findings may be specialized by the Claim, Evidence, and Assurance Model, but they use the same governed identity, state-separation, disposition, and authority principles.

Finding workflow and disposition remain separate:

- activity: open, being addressed, awaiting verification, closed;
- disposition: confirmed, resolved, accepted risk, waived by exception, duplicate, not reproducible, or invalid finding.

Severity does not decide disposition automatically.

## Approval model

### Approval Requirement

An Approval Requirement declares:

- source Policy Rule;
- exact subject type and approval purpose;
- required approver roles and qualifications;
- segregation and conflict-of-interest rules;
- quorum or aggregation rule;
- required review and evidence;
- permitted outcomes;
- validity, expiry, and reopening triggers;
- whether conditional approval is permitted;
- authorization effect, if any.

### Approval Case

An Approval Case freezes or pins:

- Decision Question or requested authorization;
- exact Resource Revisions, exact Candidate Revision Set revision, or existing Baseline Set designation;
- scope and exclusions;
- recommendation and alternatives;
- reviews and unresolved findings;
- Risk Records and accepted uncertainty;
- evidence and Context Snapshot;
- requested effective interval;
- required approver roles;
- proposed Obligations and conditions.

Changing a material element creates a new Approval Case revision and invalidates or reopens Responses according to policy.

### Approval Response

Each Approval Response records:

- Human Principal and exercised approver role;
- identity and authority evidence;
- exact Approval Case revision;
- response: approve, approve with conditions, changes requested, reject, or defer;
- rationale, accepted risks, exclusions, and conditions;
- time, validity, and revocation triggers;
- integrity reference where required.

### Approval Determination

The Approval Determination applies the declared aggregation rule to valid Approval Responses. Its outcome is:

- approved;
- conditionally approved;
- changes requested;
- rejected;
- deferred;
- incomplete;
- indeterminate.

Expired, revoked, conflicted, out-of-scope, or wrong-version Responses do not satisfy the requirement.

## Authorization model

Approval expresses accountable acceptance. Authorization permits an action. A standing Authority Grant from GAEP-CORE-002 establishes decision rights or authority source only. A Policy Evaluation, standing Authority Grant, valid Approval Determination, Decision, or approved Exception may be a source for an Authorization Grant, but none substitutes for the executable grant. The Authorization Grant binds action, Actor, target, scope, policy, state, time, and conditions.

An Authorization Grant contains:

- grant ID and revision;
- grantor and authority source;
- permitted Principal or role;
- allowed action types;
- exact subject revisions, resource selectors, and scope;
- permitted effect-descriptor set and destinations;
- valid-from, expiry, use count, or single-use rule;
- required current state and policy result;
- Obligations, conditions, and confirmations;
- revocation and invalidation triggers;
- approval, Decision, exception, and evidence references;
- non-delegable or delegation constraints.

Authorization validity is independent:

- current;
- suspended;
- expired;
- revoked;
- consumed;
- invalidated.

An action revalidates the grant immediately before a material effect when subject, state, policy, identity, or time may have changed.

## Confirmation

A Confirmation is used when an already permissible action requires human acknowledgement at action time because target, effect, destination, cost, sensitivity, or reversibility matters.

Confirmation contains:

- confirming Principal and role;
- exact action, target, destination, and expected effect;
- current preview or digest;
- reversibility and known risk;
- authorization reference;
- time and short validity;
- response.

Confirmation does not create authority absent an Authorization Grant and does not replace an Approval Requirement unless policy explicitly defines the same interaction as both and all Approval semantics are present.

## Gate boundary

A gate evaluates criteria and evidence under its domain profile. A passing gate is an Evaluation Result. If progression requires permission, an authorized decision path materializes an Authorization Grant referencing the gate result and any required Approval Determination. A tool's green result, gate pass, completed Evaluation, or completed Review is not permission by itself.

## Independence and conflicts of interest

Policy may require independence between:

- author and reviewer;
- reviewer and approver;
- requester and exception approver;
- evidence producer and evidence acceptor;
- developer and production operator;
- agent generator and human approver;
- risk beneficiary and risk acceptor.

Where a small organization combines roles, the Approval Case records the combination and compensating control. Hidden role combination is not acceptable.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-DRAA-REQ-001 | Recommendation, Decision, Review, Approval, Authorization Grant, and Confirmation SHALL remain distinct governed entities or interactions. | Entity and scenario review |
| GAEP-DRAA-REQ-002 | A Recommendation SHALL identify recommender, options considered, preferred option, rationale, evidence, assumptions, uncertainty, and scope. | Recommendation validation |
| GAEP-DRAA-REQ-003 | A Recommendation SHALL NOT be interpreted as a Decision, Approval, Risk Acceptance, or Authorization Grant. | Recommendation negative test |
| GAEP-DRAA-REQ-004 | Every material Decision Record SHALL identify Decision Question, owner, authority, scope, options, criteria, evidence, Recommendation, Outcome, consequences, and review triggers. | Decision-record validation |
| GAEP-DRAA-REQ-005 | A Decision Outcome SHALL identify exact selected option or explicit deferred, rejected-option-set, no-action, or unresolved disposition. | Outcome inspection |
| GAEP-DRAA-REQ-006 | Human selection SHALL NOT be interpreted as formal Approval or executable authorization when policy requires either separately. | Selection-versus-approval scenario |
| GAEP-DRAA-REQ-007 | Material change to Decision Question, options, criteria, evidence, scope, or selected subject SHALL create a new Decision revision and trigger declared re-evaluation. | Decision-change scenario |
| GAEP-DRAA-REQ-008 | Every Review SHALL bind to exact subject revisions or one exact Candidate Revision Set revision, criteria, reviewer identities and roles, consumed Evaluation Results, evidence, exclusions, findings, and limitations. | Review-record validation |
| GAEP-DRAA-REQ-009 | Review completion, validation success, passing tests, or AI concurrence SHALL NOT by itself approve or authorize the reviewed subject. | Review negative scenarios |
| GAEP-DRAA-REQ-010 | Every Review Finding SHALL have stable identity, subject, criterion, rationale, severity method, consequence, owner, disposition, and verification state. | Finding-record validation |
| GAEP-DRAA-REQ-011 | Finding severity, confidence, activity state, and disposition SHALL remain separate dimensions. | Finding-state inspection |
| GAEP-DRAA-REQ-012 | Waiving or accepting a material Finding SHALL reference applicable authority, Risk Record, Decision, and Policy Exception where required. | Finding-waiver scenario |
| GAEP-DRAA-REQ-013 | An Approval Requirement SHALL identify source policy, exact subject, purpose, approver roles, evidence, segregation, aggregation, allowed outcomes, and validity. | Requirement validation |
| GAEP-DRAA-REQ-014 | An Approval Case SHALL bind to exact Resource Revisions, one exact Candidate Revision Set revision, or an existing immutable Baseline Set designation and SHALL expose exclusions, uncertainty, unresolved findings, and requested scope. | Approval-package review |
| GAEP-DRAA-REQ-015 | An Approval Response SHALL identify the Human Principal, exercised role, authority source, exact Approval Case revision, response, rationale, time, and conditions. | Response validation |
| GAEP-DRAA-REQ-016 | An Agent Principal SHALL NOT provide a human Approval Response or Risk Acceptance. | AI approval negative test |
| GAEP-DRAA-REQ-017 | Approval SHALL NOT be inferred from silence, attendance, file presence, merge, generation, review, test success, or access rights. | Approval inference test |
| GAEP-DRAA-REQ-018 | An Approval Determination SHALL apply the declared aggregation rule and SHALL identify valid, invalid, missing, conflicting, expired, and revoked Responses. | Multi-approver scenario |
| GAEP-DRAA-REQ-019 | Conditional approval SHALL create explicit Obligations with owner, due condition, verification, consequence, and validity. | Conditional-approval validation |
| GAEP-DRAA-REQ-020 | A materially changed Approval Case SHALL invalidate or reopen prior Responses according to policy before new dependent authorization. | Changed-subject scenario |
| GAEP-DRAA-REQ-021 | Approval validity SHALL be re-evaluated when subject revision, policy, evidence, risk, authority, condition, or effective time changes materially. | Approval-staleness test |
| GAEP-DRAA-REQ-022 | Revocation SHALL identify revoking Principal, authority, reason, effective time, affected scope, and downstream Authorization Grants or actions. | Revocation validation |
| GAEP-DRAA-REQ-023 | Every Authorization Grant SHALL identify grantor, source authority, grantee, actions, exact target or selector, scope, applicable effect-descriptor set, destinations, validity, conditions, delegation, and invalidation triggers. | Grant-record validation |
| GAEP-DRAA-REQ-024 | An Authorization Grant SHALL NOT permit actions broader than its source standing Authority Grant, Role Assignment, Policy Evaluation, Approval Determination, Decision, Exception, or grantor authority. | Grant-amplification test |
| GAEP-DRAA-REQ-025 | A material action SHALL revalidate applicable Authorization Grant, Principal, subject revision, state, policy, time, and unsatisfied blocking Obligations immediately before effect. | Action-time authorization test |
| GAEP-DRAA-REQ-026 | Expired, revoked, suspended, consumed, invalidated, wrong-scope, or wrong-version Authorization Grants SHALL NOT permit new action. | Invalid-grant scenarios |
| GAEP-DRAA-REQ-027 | A Confirmation SHALL identify exact action, target, destination, effect, authorization, risk, reversibility, confirming Principal, and validity. | Confirmation-record validation |
| GAEP-DRAA-REQ-028 | Confirmation SHALL NOT create missing authority or replace a required Approval unless the applicable policy explicitly unifies them and every Approval requirement is met. | Confirmation negative test |
| GAEP-DRAA-REQ-029 | A gate pass, automated Policy Evaluation permit, standing Authority Grant, Decision, Exception, or Approval Determination SHALL create executable authority only through an exact applicable Authorization Grant. | Gate-to-action scenario |
| GAEP-DRAA-REQ-030 | Segregation and conflict-of-interest rules SHALL be evaluated for every Approval Case where policy requires them. | Role-conflict scenario |
| GAEP-DRAA-REQ-031 | Combined roles SHALL be disclosed with compensating controls when policy permits role combination. | Small-team scenario |
| GAEP-DRAA-REQ-032 | External or offline Approval Responses SHALL preserve exact subject, identity, role, authority, time, outcome, conditions, evidence reference, and integrity needed by policy. | Offline-approval scenario |
| GAEP-DRAA-REQ-033 | Unknown, ambiguous, conflicting, or unverifiable Approval or Authorization state SHALL NOT be interpreted as permission. | Failure-mode negative test |
| GAEP-DRAA-REQ-034 | Every executable policy path, including paths with no human Approval Requirement, SHALL materialize a current Authorization Grant before commitment and SHALL preserve the Policy Evaluation as a source reference. | Policy-to-grant materialization test |
| GAEP-DRAA-REQ-035 | Standing Authority Grant, Policy Evaluation, Approval Determination, Decision, Exception, Review, Evaluation Result, gate result, and Confirmation SHALL NOT be accepted as executable permission in place of an Authorization Grant. | Authorization-substitution negative test |
| GAEP-DRAA-REQ-036 | Review and Evaluation SHALL remain distinct: Review orchestrates and judges the sufficiency of one or more exact Evaluation Results plus attributable Review Contributions, while Evaluation produces an epistemic result under a declared method. | Review-evaluation boundary scenario |
| GAEP-DRAA-REQ-037 | Decision authoring lifecycle, revision disposition, operational eligibility, Decision Outcome, and decision effectiveness SHALL remain independent state dimensions. | Decision-state inspection |
| GAEP-DRAA-REQ-038 | A completed Review SHALL emit exactly one Review Conclusion for that Review revision, binding all Evaluation Results and Contributions considered and exposing omitted, conflicting, stale, or insufficient inputs. | Review-conclusion validation |

## Relationship and cardinality contract

| Source | Relationship | Target | Cardinality and rule |
|---|---|---|---|
| Recommendation | recommends | Decision Option | One preferred option or explicit no-preference; alternatives remain visible. |
| Decision Record | answers | Decision Question | Exactly one primary question. |
| Decision Record | considers | Decision Option | Two or more where a real choice exists; one may be no action. |
| Decision Record | results in | Decision Outcome | At most one effective Outcome per Decision revision and scope. |
| Review | reviews | Resource Revision, Candidate Revision Set, or Baseline Set | One or more exact subjects, or one exact set revision, forming a declared coherent review scope. |
| Review | consumes | Evaluation Result | One or more exact Evaluation Results for a completed Review unless the Review records why none are applicable. |
| Review | contains | Review Contribution | One or more for completed human or AI review unless deterministic review is explicitly declared. |
| Review Contribution | produces | Review Finding | Zero or more. |
| Review | emits | Review Conclusion | Exactly one per completed Review revision. |
| Approval Case | satisfies | Approval Requirement | Exactly one primary requirement; compound cases declare each additional requirement explicitly. |
| Approval Case | contains | Approval Response | Zero or more, one per Principal-role-response revision. |
| Approval Determination | aggregates | Approval Response | All responses considered under the declared aggregation rule. |
| Authorization Grant | derived from | Authority Grant, Policy Evaluation, Approval Determination, Decision, or Exception | One or more sufficient authority sources; the derived grant is the only executable permission record. |
| Confirmation | confirms | Authorized action | Exactly one action preview and Authorization Grant context. |

## Negative cases

| Case | Required result |
|---|---|
| Three AI reviewers agree with a design | Their Reviews may strengthen evidence but do not provide human Approval. |
| An architect selects an option but security approval is required | Decision Outcome is recorded; authorization waits for the required Approval Determination. |
| A pull request is merged | Merge is an execution fact, not implicit approval of Product scope, architecture, risk, or release. |
| One of two required approvers approved an older subject revision | The Approval Determination is incomplete for the new revision. |
| Approval is conditional on closing two findings | Two Obligations are created and authorization follows the permitted conditional scope. |
| A user clicks confirm after authorization expired | Confirmation does not restore authority; a new or renewed Authorization Grant is required. |
| A gate passed against evidence for another build | The result does not authorize the current subject revision. |
| An approval arrives through email | It is usable only if identity, role, exact subject, outcome, time, conditions, authority, and integrity satisfy policy. |
| A review finding is marked low severity | Severity alone does not close or waive it. |
| Policy permits a read-only action with no human approval | A policy-derived Authorization Grant permits it; no artificial human Approval is invented and no implicit authorization path is accepted. |

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-DRAA-OD-001 | Which Approval aggregation rules and quorum semantics belong in Core? | Affects multi-role portability and organization-specific governance. |
| GAEP-DRAA-OD-002 | Is Approval Response always restricted to a Human Principal, while deterministic organizational authorization uses only Authorization Grant? | Affects terminology and automated governance clarity. |
| GAEP-DRAA-OD-003 | Which integrity evidence is mandatory for offline or cross-organization Approval? | Affects federation without selecting signature technology. |
| GAEP-DRAA-OD-004 | Should Authorization Grant support standing role selectors in Core or require resolved Principal lists at use time? | Affects dynamic teams and historical reconstruction. |
| GAEP-DRAA-OD-005 | Which Review Finding severity and disposition values are Core versus profile registries? | Affects common reporting and domain specialization. |
| GAEP-DRAA-OD-006 | How should abstention, recusal, veto, and dissent be represented in multi-party Approval Cases? | Affects governance council and specialist-review profiles. |
| GAEP-DRAA-OD-007 | Which material changes automatically reopen Approval versus requiring profile-declared impact analysis? | Affects safety, approval fatigue, and state determinism. |

## Cross-contract dependencies

- Decision and approval scopes use GAEP-CORE-001.
- Principal, role, authority chain, delegation, and accountability use GAEP-CORE-002.
- All exact subjects, case revisions, and Baseline Sets use GAEP-CORE-003.
- Lifecycle, validity, events, and transition history use GAEP-CORE-004.
- Policy, Risk Records, Exceptions, and Obligations use GAEP-CORE-005.
- Claim and evidence quality semantics are expected from the downstream Core claim-and-evidence contract.
