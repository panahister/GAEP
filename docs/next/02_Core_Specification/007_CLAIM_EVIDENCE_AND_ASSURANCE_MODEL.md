---
id: GAEP-CORE-007
title: Claim, Evidence, and Assurance Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP claims, evidence, assurance cases, evaluations, findings, and gates
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
  - GAEP-CORE-006
core_package_interfaces:
  - GAEP-CORE-008
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Claim, Evidence, and Assurance Model

## Purpose

This document defines how GAEP represents bounded claims, evidence, assurance arguments, findings, evaluations, and gate results without confusing confidence, activity, approval, or document presence with proof.

## Scope and non-goals

This model governs semantic contracts and conformance. It does not prescribe a test framework, evidence store, scoring formula, assurance methodology, certification scheme, or implementation technology. It does not make one evidence type universally sufficient.

## Core concepts

| Concept | Meaning |
|---|---|
| Claim | A bounded, falsifiable statement about an identified subject, version, scope, environment, and validity interval. |
| Evidence item | An attributable observation, result, record, or artifact that supports, contradicts, or qualifies a claim. |
| Assurance case | A versioned claim-argument-evidence structure that explains why evidence is sufficient and exposes assumptions and defeaters. |
| Evaluation Definition | Versioned epistemic procedure declaring criteria, method, expected results, evidence outputs, evaluator needs, limitations, and invalidation triggers. |
| Evaluation Run | Application of one exact Evaluation Definition to exact subject, configuration, environment, data, and tool or model versions. |
| Evaluation Result | Immutable epistemic result of an Evaluation Run, with findings, evidence, limitations, confidence method, and accountable evaluator. It does not perform governance Review or grant permission. |
| Finding | A versioned evidence or assurance observation requiring disposition; a finding is not automatically a defect or accepted risk. |
| Gate | An evaluation contract whose result assesses identified criteria and evidence for an exact transition or action. |
| Defeater | Evidence or reasoning that could invalidate or materially weaken a claim or assurance argument. |

AI confidence, human confidence, a generated rationale, execution completion, file presence, and approval are not evidence unless an applicable evidence contract explicitly defines the observable fact they establish.

A Review Finding governed by GAEP-CORE-006 is the review-origin specialization of the shared Finding concept. A Review is the governance activity that commissions or consumes exact Evaluation Results and attributable Review Contributions, judges their sufficiency, and emits a Review Conclusion. Evaluation owns the epistemic procedure and result only. Review workflow, activity, disposition, approval, and authorization remain governed by GAEP-CORE-006; evaluation and gate findings use the evidence, subject-binding, and assurance semantics in this document.

## Core invariants

- Every material claim is bounded to an exact subject and context.
- Evidence remains attributable, version-bound, reviewable, and distinct from approval or confidence.
- Adverse and inconclusive evidence remains visible until governed disposition.
- Assurance exposes its argument, assumptions, defeaters, gaps, and independence limits.
- Gate and conformance results never silently broaden the claims their evidence can support.

## Claim contract

A claim record contains:

- stable claim ID, type, owner, and version;
- precise statement and declared falsification conditions;
- subject ID and exact subject version or digest;
- governed scope, environment, configuration, and validity interval;
- applicable requirements, policies, risks, and assumptions;
- required evidence classes and acceptance criteria;
- current assessment state and assessor identity;
- linked supporting, contradicting, and qualifying evidence;
- known gaps, exclusions, residual uncertainty, and defeaters;
- review, expiry, invalidation, and supersession triggers.

Claim assessment state is separate from claim lifecycle. The controlled assessment results are `not-assessed`, `supported`, `partially-supported`, `not-supported`, and `inconclusive`. A supported claim may later become stale or invalidated.

## Evidence contract

An evidence item contains:

- stable evidence ID, type, producer, and capture time;
- subject and claim references with exact versions or digests;
- observation or result, including unfavorable and inconclusive outcomes;
- method, criteria, procedure version, tools, configuration, environment, and relevant data reference;
- provenance chain and integrity reference;
- evaluator or executor identity and independence characteristics;
- classification, permitted recipients, retention, and disposal obligations;
- quality assessment, limitations, anomalies, and reproducibility conditions;
- freshness, expiry, invalidation, and supersession triggers.

Evidence quality is assessed across relevance, validity, authenticity, integrity, coverage, independence, freshness, reproducibility, sensitivity, and interpretability. One aggregate score must not conceal a failed material dimension.

Evidence uses separate State Dimensions under GAEP-CORE-004:

- authoring lifecycle, such as `draft`, `proposed`, `in-review`, or `finalized`;
- evidence assessment, such as `not-assessed`, `fit-for-declared-use`, `not-fit-for-declared-use`, `inconclusive`, or `disputed`;
- freshness, such as `current`, `potentially-stale`, `stale`, or `unknown`;
- validity, such as `valid` or `invalidated`;
- revision disposition, such as `candidate`, `current`, `withdrawn`, or `superseded`;
- operational eligibility, such as `eligible`, `deprecated`, or `retired`;
- retention, such as `active-retention`, `archived`, `retained`, or `disposed`.

`fit-for-declared-use` means fit for named claims and scope; it does not mean the evidence proves every related claim. State values become controlled only through the applicable Core or profile registry and are never collapsed into one evidence status.

## Assurance case contract

An assurance case contains:

1. top-level and supporting claims;
2. an explicit argument connecting each claim to evidence;
3. assumptions, dependencies, and scope boundaries;
4. material counter-evidence and defeaters;
5. evidence-quality and independence analysis;
6. unresolved gaps and residual uncertainty;
7. accountable reviewer and approval references where required;
8. review, expiry, and invalidation triggers.

The argument must be reviewable without access to hidden model reasoning. Source citations, observable transformations, criteria, and evidence are the explanation surface; private chain-of-thought is not a required artifact.

## Evaluation and gate semantics

An Evaluation Definition identifies its subject classes, criteria, fixtures or samples, expected outcomes, evaluator qualifications, independence level, failure behavior, evidence outputs, and change triggers. An Evaluation Run binds that definition to exact subject, configuration, environment, and data versions. An Evaluation Result records the epistemic outcome, evidence, findings, uncertainty, and limitations of that exact run. A GAEP-CORE-006 Review consumes those exact results and contributions to decide review sufficiency; it does not duplicate or silently recompute them.

A gate result is one of `not-assessed`, `incomplete`, `failed`, `conditionally-passed`, `passed`, or `blocked`. A pending waiver or exception is not a passed gate. A gate result contains the criteria evaluated, non-applicable criteria with rationale, evidence references, findings, conditions, accountable evaluator, effective time, expiry, invalidation triggers, and any dependent Approval Determination or Authorization Grant references.

A passing gate is an Evaluation Result, not permission. Progression requiring permission follows GAEP-DRAA-REQ-029 only through an exact applicable Authorization Grant; approval and authorization semantics remain owned by GAEP-CORE-006.

## Independence and evidence strength

Independence is multidimensional. A separate run using the same model, prompt, retrieval source, evaluator, and assumptions may provide little independence. Applicable profiles determine required separation across author, evaluator, data source, method, model or tool, organizational role, and approval authority.

Evidence strength is proportional to the consequence of a false claim. High-consequence claims require stronger source authenticity, negative evidence, adversarial evaluation, qualified review, and independent confirmation than low-risk reversible claims.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-CAE-REQ-001 | Every material claim SHALL bind to an identified subject and exact version or content digest. | Claim-record inspection |
| GAEP-CAE-REQ-002 | A claim SHALL identify scope, environment, validity, assumptions, and falsification conditions sufficient to prevent unbounded interpretation. | Boundary scenario review |
| GAEP-CAE-REQ-003 | Claim lifecycle, claim assessment, evidence authoring lifecycle, evidence assessment, freshness, validity, revision disposition, retention, gate result, approval, authorization, and conformance state SHALL remain distinct under GAEP-CORE-004. | State-model inspection |
| GAEP-CAE-REQ-004 | AI confidence, generated rationale, human confidence, file presence, and execution completion SHALL NOT be treated as proof of a substantive claim. | Negative scenario test |
| GAEP-CAE-REQ-005 | Every evidence item SHALL identify producer, method, subject version, capture context, result, provenance, integrity, classification, and limitations. | Evidence-schema validation |
| GAEP-CAE-REQ-006 | Unfavorable, failed, and inconclusive evidence SHALL be retained and dispositioned according to policy; it SHALL NOT be silently omitted or reclassified. | Adverse-evidence scenario |
| GAEP-CAE-REQ-007 | Evidence acceptance SHALL be scoped to named claims and SHALL NOT silently certify other versions, environments, configurations, or subjects. | Cross-version negative test |
| GAEP-CAE-REQ-008 | An assurance case SHALL expose material assumptions, counter-evidence, defeaters, gaps, and residual uncertainty. | Assurance-case review |
| GAEP-CAE-REQ-009 | A material assurance conclusion SHALL identify the argument connecting evidence to the claim; a list of evidence alone SHALL NOT be sufficient. | Argument completeness review |
| GAEP-CAE-REQ-010 | Evidence quality SHALL be evaluated across declared dimensions without hiding a material failed dimension inside one aggregate score. | Quality-assessment inspection |
| GAEP-CAE-REQ-011 | Required evidence independence SHALL be declared by the applicable profile and recorded in the evidence item. | Independence-profile test |
| GAEP-CAE-REQ-012 | A separate AI run SHALL NOT be represented as independent merely because it has a different run ID. | Correlated-review negative test |
| GAEP-CAE-REQ-013 | An Evaluation Definition SHALL declare criteria, expected results, evidence outputs, evaluator needs, failure behavior, limitations, and invalidation triggers. | Evaluation-contract validation |
| GAEP-CAE-REQ-014 | An Evaluation Result SHALL bind to exact Evaluation Definition, Evaluation Run, subject, configuration, environment, data, and tool or model versions where applicable. | Evaluation-record inspection |
| GAEP-CAE-REQ-015 | Model-based or probabilistic evaluation SHALL disclose its limitations and SHALL NOT be the sole acceptance evidence for a high-consequence claim unless an approved profile explicitly permits it. | High-risk gate scenario |
| GAEP-CAE-REQ-016 | A gate SHALL evaluate only declared criteria and SHALL expose missing, non-applicable, failed, waived, and conditional criteria separately. | Gate-result validation |
| GAEP-CAE-REQ-017 | A pending waiver, missing evaluation, unavailable environment, flaky result, or inconclusive result SHALL NOT resolve to `passed`. | Negative gate scenarios |
| GAEP-CAE-REQ-018 | A conditional pass SHALL identify obligations, owners, due or trigger conditions, validation, consequence of non-compliance, and expiry. | Conditional-gate review |
| GAEP-CAE-REQ-019 | A declared subject, dependency, assumption, policy, or version trigger SHALL update the applicable freshness, validity, revision-disposition, or assessment dimension of an affected claim, evidence item, assurance case, evaluation, or gate result without collapsing those dimensions. | Change-invalidation scenario |
| GAEP-CAE-REQ-020 | Reassessment SHALL preserve prior conclusions and evidence through traceable supersession rather than destructive replacement. | History and supersession test |
| GAEP-CAE-REQ-021 | Evidence containing sensitive information SHALL be minimized, classified, access-controlled, retained, and disposed according to applicable obligations. | Handling-policy review |
| GAEP-CAE-REQ-022 | A summary SHALL preserve a resolvable path to underlying evidence and SHALL disclose material omissions or transformations. | Summary-provenance test |
| GAEP-CAE-REQ-023 | Evidence integrity SHALL be protected from the subject or agent whose claim it evaluates at the independence level required by profile. | Tamper scenario analysis |
| GAEP-CAE-REQ-024 | Assurance conclusions and gate results SHALL identify the accountable evaluator and evidence actually considered; any dependent approval or authorization SHALL reference the applicable GAEP-CORE-006 record. | Evaluation-record inspection |
| GAEP-CAE-REQ-025 | A conformance claim SHALL reference the requirements and evidence that establish it and SHALL disclose unsupported requirements and deviations. | Conformance-case review |
| GAEP-CAE-REQ-026 | Evaluation Definition, Evaluation Run, Evaluation Result, Review, Review Contribution, and Review Conclusion SHALL remain distinct governed records with explicit relationships. | Evaluation-review entity inspection |
| GAEP-CAE-REQ-027 | A Review governed by GAEP-CORE-006 SHALL consume exact Evaluation Results and attributable Review Contributions and SHALL expose which inputs were accepted, rejected, omitted, stale, conflicting, or insufficient in its Review Conclusion. | Review-input trace scenario |
| GAEP-CAE-REQ-028 | Completion or success of an Evaluation, Evaluation Run, Evaluation Result, or gate SHALL NOT imply Review completion, Approval, Authorization Grant, conformance, or permission. | Evaluation-substitution negative test |
| GAEP-CAE-REQ-029 | A Review Finding SHALL specialize the shared Finding contract and SHALL trace to the Review Contribution, Evaluation Result, evidence, and criterion from which it arose where applicable. | Finding-origin trace review |

## Required negative cases

- Evidence belongs to a prior subject version.
- A model claims success without an authoritative observation.
- Supporting evidence is present but material counter-evidence is omitted.
- The same agent generates, evaluates, and attempts to approve a high-risk result.
- An evaluation dataset, tool, model, or environment changes after approval.
- A gate receives a missing, flaky, stale, or inconclusive result.
- A summary hides exclusions or breaks the path to underlying evidence.
- Sensitive evidence is copied into a less-protected context or log.

## Trust considerations

Evidence is data, not automatically an instruction. Evidence authenticity and semantic authority are separate: a genuine record may be irrelevant, and a relevant record may have uncertain origin. Evidence-producing capabilities, clocks, identities, transformation steps, and stores are part of the assurance trust boundary. A compromised or self-reported evidence path must not inherit trust from a valid-looking identifier or signature alone.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-CAE-OD-001 | What is the minimum assurance-case schema, and are structured argument patterns required? | Affects portability and reviewer burden. |
| GAEP-CAE-OD-002 | Which evidence-quality and evaluator-independence levels are controlled Core values? | Affects profile composition and gate comparability. |
| GAEP-CAE-OD-003 | Which claim classes require integrity protection beyond ordinary resource provenance? | Affects audit and distributed trust. |
| GAEP-CAE-OD-004 | What freshness and retention defaults apply to each evidence class? | Affects reassessment, privacy, and records obligations. |
| GAEP-CAE-OD-005 | Is partial conformance permitted for individual Core requirement groups? | Affects conformance claims and adoption sequencing. |
