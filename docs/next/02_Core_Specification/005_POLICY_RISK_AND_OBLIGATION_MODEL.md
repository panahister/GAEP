---
id: GAEP-CORE-005
title: Policy, Risk, and Obligation Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Policy and Risk Steward
scope: Policy definition and composition, risk representation, exceptions, conditions, and enforceable obligations
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
core_package_interfaces:
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references:
  - ../../01_Foundation/001_GAEP_CONSTITUTION.md
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../03_Product_Engineering/023_CHANGE_MANAGEMENT.md
  - ../../05_AI_Runtime/045_STOP_CONDITIONS.md
supersedes: []
---

# Policy, Risk, and Obligation Model

## Purpose

This document defines how GAEP represents governing rules, evaluates them for a specific action, combines policy sources, records risk and uncertainty, creates enforceable obligations, and handles explicit exceptions.

Policy determines whether an evaluated action is eligible, prohibited, constrained, or requires further authorization. A Policy Evaluation never grants executable permission; every executable permit path must materialize an Authorization Grant under GAEP-CORE-006. Risk informs policy and accountable judgment but does not itself grant permission. An Obligation is a durable requirement assigned to an owner and verified through evidence; it is not satisfied merely because work continued.

## Conceptual boundary

This model owns:

- Policy Sets, Policy Rules, targets, effects, and composition;
- Policy Evaluation Records and explicit results;
- Risk Records, assessment, treatment, acceptance references, and residual risk;
- Obligations and their fulfillment lifecycle;
- policy exceptions and compensating controls as governed constraints.

This model does not own:

- Principal identity or role assignment;
- human decision and approval procedure;
- runtime enforcement technology;
- organization-specific risk formulas;
- legal interpretation;
- evidence content or quality assessment.

GAEP-CORE-006 governs decisions and approvals that accept risk, grant exceptions, or authorize action.

## Policy entities

| Entity | Meaning |
|---|---|
| Policy Authority | Scope-bearing authority entitled to issue a Policy Set or Policy Rule. |
| Policy Set | Versioned collection of Policy Rules with declared scope, precedence, combination, and effective interval. |
| Policy Rule | Addressable rule matching Principal, action, resource, scope, environment, purpose, state, classification, risk, or other declared attributes. |
| Policy Target | Structured condition identifying where and when a Policy Rule applies. |
| Policy Effect | Permit, deny, require additional authorization, or create one or more Obligations. |
| Policy Binding | Approved association between a Policy Set and Organization, Managed Asset, Initiative, Change, Implementation Unit, Workspace, capability, or action scope. |
| Base Policy Envelope | Resolved set of applicable constitutional, legal, contractual, organizational, scope, and source-authority constraints that is independent of any profile selection and is used to bound profile applicability. |
| Profile Selection Manifest | Exact input produced by profile resolution identifying selected, excluded, conflicting, and unresolved profile revisions and rationale. Policy consumes this manifest; it does not create it. |
| Effective Policy Snapshot | Immutable composition of the Base Policy Envelope, exact Policy Bindings, and contributions from an explicit Profile Selection Manifest for one governed scope and time. |
| Policy Exception | Versioned, scoped, time-bounded variation from a rule, supported by rationale, risk, compensating controls, approval, and closure. |
| Policy Evaluation | Immutable evaluation of exact policy, identity, action, resource, state, scope, and context versions. |
| Combining Algorithm | Declared rule for resolving several applicable effects and obligations. |

## Policy target model

A Policy Target may constrain:

- Principal kind, identity, role, assignment, or authority source;
- action type and effect class;
- exact resource, Resource Type, revision, or classification;
- Organization, Portfolio, Managed Asset, Initiative, Change, Implementation Unit, or Workspace;
- lifecycle, validity, freshness, or operational state;
- environment, destination, recipient, provider, jurisdiction, or purpose;
- reversibility, blast radius, cost, data sensitivity, or Risk Record;
- effective time and expiry;
- profile and conformance class.

Target attributes use controlled registries or declared extension namespaces.

## Policy effects and evaluation results

Policy Rules produce effects. The effective Policy Evaluation result is one of:

| Result | Meaning |
|---|---|
| permitted | Policy presents no prohibition for the exact result scope and validity; execution still requires an applicable Authorization Grant. |
| permitted-with-obligations | Policy presents no prohibition while named Obligations are enforced; execution still requires an applicable Authorization Grant. |
| additional-authorization-required | Policy does not permit progression until an identified Authorization Grant exists. |
| denied | An applicable prohibition prevents the action. |
| not-applicable | The evaluated Policy Set does not govern the target; this is not permission from another policy source. |
| indeterminate | Required input, policy interpretation, capability, or conflict cannot be resolved safely. |

The combining algorithm declares how deny, permit, additional authorization, and obligations interact. A realization must not invent a combining order. Policy result vocabulary is evaluative: neither `permitted` nor `permitted-with-obligations` is an executable authorization record.

## Policy hierarchy and composition

Potential sources include law, regulation, contract, Constitution, organizational policy, portfolio or asset policy, Initiative policy, explicitly selected profile obligations, capability policy, and approved exception. Their applicability depends on scope, issuing authority, effective time, and jurisdiction.

Specificity alone does not override higher authority. Lower-scope policy may strengthen controls. Weakening an applicable higher obligation requires an explicitly permitted, approved exception path; some prohibitions are non-exceptionable.

Resolution is staged to prevent policy/profile recursion. First, a Base Policy Envelope is resolved without selected-profile inputs. Profile resolution uses that envelope to produce an explicit Profile Selection Manifest. Only then may policy composition consume the selected profile contributions and produce an Effective Policy Snapshot. Policy resolution never selects profiles, and profile applicability never depends on an Effective Policy Snapshot that already includes the profile being tested.

An Effective Policy Snapshot records:

- every Policy Set and revision considered;
- Policy Bindings and the exact Profile Selection Manifest revision;
- applicable and non-applicable rules;
- conflicts and combination;
- exceptions;
- resulting effects and Obligations;
- source and evaluation time.

## Risk entities

| Entity | Meaning |
|---|---|
| Risk Record | Versioned statement of uncertainty that may affect an objective, asset, decision, obligation, or outcome. |
| Risk Source | Threat, hazard, dependency, assumption, ambiguity, vulnerability, opportunity, or external condition producing uncertainty. |
| Risk Assessment | Evaluation of likelihood or plausibility, impact dimensions, exposure, uncertainty, evidence, and confidence under a declared method. |
| Risk Treatment | Avoid, reduce, transfer/share, monitor, exploit where opportunity applies, or accept through accountable decision. |
| Control | Preventive, detective, corrective, or recovery measure intended to change risk. |
| Residual Risk | Risk remaining after declared controls and treatment. |
| Risk Acceptance | Decision and approval references accepting exact residual risk for a scope and interval. |
| Risk Profile | Versioned method and thresholds selected for a scope; it may define tiers without changing Core semantics. |

Risk tiers are profile-defined. A tier label is incomplete without the method, factors, evidence, uncertainty, scope, and version that produced it. Risk Tier and Approval Level are separate concepts unless a Policy Rule explicitly maps them.

## Risk record contents

A material Risk Record contains:

- canonical ID and revision;
- statement in cause-condition-consequence form where practical;
- affected objectives and scopes;
- source and trigger;
- likelihood or plausibility assessment;
- impact dimensions and severity;
- uncertainty, assumptions, and evidence;
- current controls and effectiveness;
- proposed treatment and owner;
- residual risk;
- acceptance authority and validity when accepted;
- review, escalation, and invalidation triggers;
- related decisions, changes, obligations, incidents, and outcomes.

## Obligation model

An Obligation is created by policy, approval condition, exception, contract, gate, decision, or transition. It contains:

- Obligation ID and revision;
- source requirement and exact source revision;
- obligated Principal or owner role;
- beneficiary or protected scope where relevant;
- required outcome or action;
- subject and scope;
- due time, milestone, event, or continuing condition;
- verification criteria and required evidence;
- state and priority;
- consequence of non-fulfillment;
- escalation and exception path;
- satisfaction, waiver, invalidation, or closure record.

### Obligation state dimensions

GAEP-REG-007 owns the exact machine values. Obligation state is the orthogonal combination of:

- applicability: `applicable`, `not-applicable`, or `unresolved`;
- strength: `required`, `conditional`, `recommended`, or `optional`;
- activity: `inactive`, `active`, `blocked`, or `closed`;
- timing: `not-due`, `due`, `overdue`, or `expired`;
- fulfillment: `unsatisfied`, `in-progress`, `satisfied`, or `satisfied-through-reuse`;
- disposition: `active`, `waived`, `replaced`, or `cancelled`.

A closed Obligation is not necessarily satisfied, and deferral is not fulfillment. A due date change creates a governed revision or authorized transition. Profile extensions may add namespaced values only through declared variation points and compatibility mappings.

## Policy exception

A Policy Exception identifies:

- exact Rule varied;
- non-exceptionable higher rules checked;
- scope, action, resources, and Principals covered;
- rationale and alternatives;
- Risk Assessment and accepted residual risk;
- compensating controls;
- approval and authority;
- effective and expiry conditions;
- Obligations;
- monitoring, review, revocation, and closure.

An exception is not precedent and does not modify the original Rule. Repeated exceptions create a review signal.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-POLICY-REQ-001 | Every Policy Rule SHALL have stable identity, version, issuing Policy Authority, target, effect, effective interval, and exception behavior. | Policy-schema validation |
| GAEP-POLICY-REQ-002 | Policy targets SHALL identify action, resource or resource type, scope, and Principal conditions at the precision required by the governed effect. | Target decision-table review |
| GAEP-POLICY-REQ-003 | Policy effects SHALL use controlled values for permit, deny, additional authorization, and Obligation creation. | Effect-registry validation |
| GAEP-POLICY-REQ-004 | Every Policy Set SHALL declare its Combining Algorithm or reference an exact approved algorithm definition. | Policy-set validation |
| GAEP-POLICY-REQ-005 | A Policy Evaluation SHALL use exact Policy Set, Policy Binding, identity, scope, resource, state, and action versions available at evaluation time. | Evaluation-record inspection |
| GAEP-POLICY-REQ-006 | A Policy Evaluation SHALL return permitted, permitted-with-obligations, additional-authorization-required, denied, not-applicable, or indeterminate with reason codes and source rules, and SHALL NOT be consumed as executable authorization. | Policy decision-table test |
| GAEP-POLICY-REQ-007 | Not-applicable from one Policy Set SHALL NOT be interpreted as global permission. | Missing-policy negative test |
| GAEP-POLICY-REQ-008 | Indeterminate, conflicting, unsupported, or unavailable required policy SHALL NOT resolve to silent permission. | Policy failure scenarios |
| GAEP-POLICY-REQ-009 | Lower-scope policy SHALL NOT weaken a higher applicable mandatory rule without an explicitly permitted and approved Policy Exception. | Policy hierarchy scenario |
| GAEP-POLICY-REQ-010 | A non-exceptionable prohibition SHALL remain denied regardless of lower policy, profile, configuration, or local preference. | Non-exceptionable rule test |
| GAEP-POLICY-REQ-011 | Every Policy Binding SHALL identify Policy Set source, governed scope, precedence, effective interval, and conflict behavior; profile selection SHALL be represented separately by an exact Profile Selection Manifest. | Effective-policy snapshot review |
| GAEP-POLICY-REQ-012 | Every material Policy Evaluation SHALL create an immutable record containing considered rules, result, obligations, exceptions, inputs, time, and invalidation triggers. | Evaluation audit inspection |
| GAEP-POLICY-REQ-013 | Policy change affecting an active plan, approval, authorization, transition, or Obligation SHALL trigger re-evaluation before the next dependent material effect. | Policy-change-during-run scenario |
| GAEP-POLICY-REQ-014 | A Risk Record SHALL identify affected scope, source, impact, likelihood or plausibility, uncertainty, evidence, owner, treatment, residual risk, and review triggers. | Risk-record validation |
| GAEP-POLICY-REQ-015 | Risk tier or score SHALL identify the exact Risk Profile, method, factors, exclusions, and evidence used. | Risk-calculation review |
| GAEP-POLICY-REQ-016 | A Risk Tier SHALL NOT be interpreted as an Approval Level unless an applicable Policy Rule defines the mapping. | Tier-mapping negative test |
| GAEP-POLICY-REQ-017 | Risk Acceptance SHALL bind to exact residual Risk Record revision, scope, decision, approver authority, validity, conditions, and review triggers. | Risk-acceptance validation |
| GAEP-POLICY-REQ-018 | AI recommendation or confidence SHALL NOT constitute Risk Acceptance. | AI risk negative scenario |
| GAEP-POLICY-REQ-019 | Every material Obligation SHALL identify source revision, owner, scope, required outcome, due condition, verification, evidence, consequence, and state. | Obligation-record validation |
| GAEP-POLICY-REQ-020 | Every enforceable condition received from an Approval Determination SHALL be represented as an explicit Obligation without making this contract the owner of approval procedure. | Conditional-approval scenario |
| GAEP-POLICY-REQ-021 | Closing an Obligation SHALL record whether it was satisfied, waived, cancelled, invalidated, or left unsatisfied. | Obligation closure test |
| GAEP-POLICY-REQ-022 | Obligation satisfaction SHALL require the declared verification and evidence; elapsed time, file presence, merge, or assertion alone SHALL NOT satisfy it. | Satisfaction negative test |
| GAEP-POLICY-REQ-023 | Waiving an Obligation SHALL require an approved exception or other authority explicitly permitted by the source rule. | Waiver negative test |
| GAEP-POLICY-REQ-024 | An overdue or unsatisfied Obligation SHALL expose its consequence and escalation state before dependent authorization or transition. | Overdue-obligation scenario |
| GAEP-POLICY-REQ-025 | Every Policy Exception SHALL identify exact Rule, scope, rationale, risk, compensating controls, approval, effective interval, obligations, and closure criteria. | Exception-record validation |
| GAEP-POLICY-REQ-026 | A Policy Exception SHALL NOT silently alter the original Policy Rule or establish general precedent. | Repeated-exception scenario |
| GAEP-POLICY-REQ-027 | Expired, revoked, out-of-scope, or condition-breached Policy Exceptions SHALL NOT permit new dependent action. | Exception-expiry test |
| GAEP-POLICY-REQ-028 | Sensitive policy, risk, and exception records MAY protect payload detail, but SHALL preserve enough identity, authority, result, scope, and integrity for their declared governance purpose. | Redacted-governance review |
| GAEP-POLICY-REQ-029 | A Base Policy Envelope SHALL be resolvable from constitutional, legal, contractual, organizational, scope, and source-authority inputs without depending on selected profiles or effective profile configuration. | Bootstrap-resolution test |
| GAEP-POLICY-REQ-030 | An Effective Policy Snapshot that includes profile contributions SHALL consume one exact Profile Selection Manifest and SHALL preserve every selected, excluded, conflicting, and unresolved profile result relevant to the evaluation scope. | Staged-composition review |
| GAEP-POLICY-REQ-031 | A policy resolver SHALL NOT select profiles, infer profile selection from file presence or defaults, or recursively depend on an Effective Policy Snapshot containing the profile being assessed. | Circular-resolution negative test |
| GAEP-POLICY-REQ-032 | Any executable path resulting from `permitted` or `permitted-with-obligations` SHALL materialize a current, exact, applicable Authorization Grant under GAEP-CORE-006 before commitment; the Policy Evaluation SHALL remain a source record on that grant. | Permit-to-grant trace test |

## Negative cases

| Case | Required result |
|---|---|
| No policy rule matches a destructive action | The effective result is not silent permission; applicable defaults and indeterminate behavior are evaluated. |
| An Initiative profile says approval is optional but organization policy requires it | The higher applicable requirement remains; conflict is visible. |
| A high Risk Tier is calculated with an old profile | The result identifies the old profile and may become stale; it does not silently inherit current thresholds. |
| A reviewer says a risk is acceptable | The statement is a recommendation until the accountable decision and approval bind the residual Risk Record. |
| Conditional approval requires a security review within ten days | A durable Obligation identifies owner, due condition, evidence, consequence, and completion status. |
| The condition's due date passes | The Obligation becomes overdue; dependent permission follows policy and is not assumed to continue. |
| An exception expires during a paused run | Policy is re-evaluated before the next effect; the prior result does not continue. |
| Several low-level policies permit an action but one applicable non-exceptionable policy denies it | The declared Combining Algorithm preserves the denial. |
| A local configuration omits a required rule | Omission is reported; configuration does not weaken approved policy. |

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-POLICY-OD-001 | Which combining algorithms are standardized in Core and which remain profile-defined? | Affects portability and policy-engine neutrality. |
| GAEP-POLICY-OD-002 | What minimum action and resource vocabularies belong in Core registries? | Affects cross-runtime policy interoperability. |
| GAEP-POLICY-OD-003 | Should Core define a default deny result for every material effect or allow profiles to define domain defaults? | Affects safety and lightweight adoption. |
| GAEP-POLICY-OD-004 | Which risk dimensions and uncertainty vocabulary are universal? | Affects comparable risk without forcing one scoring method. |
| GAEP-POLICY-OD-005 | Can continuing Obligations remain satisfied through continuous evidence, or are periodic evaluations always separate records? | Affects operational controls and evidence freshness. |
| GAEP-POLICY-OD-006 | How are legal or contractual rules represented when interpretation cannot be reduced to deterministic policy? | Affects indeterminate results and qualified human review. |
| GAEP-POLICY-OD-007 | Which repeated-exception thresholds trigger mandatory policy review? | Affects adaptive governance without universal numeric limits. |

## Cross-contract dependencies

- Policy target scopes come from GAEP-CORE-001.
- Policy Authorities, Principals, roles, and authority chains come from GAEP-CORE-002.
- Policy, Risk, Exception, and Obligation revisions use GAEP-CORE-003.
- Their state transitions and events use GAEP-CORE-004.
- Risk Acceptance, exception approval, and Authorization Grants are governed by GAEP-CORE-006.
