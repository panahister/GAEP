---
id: GAEP-REG-006
title: Candidate Relationship Registry
document_type: registry
schema_version: 1.0
version: 0.2.0
status: proposed
owner_role: GAEP Semantic Registry Steward
scope: Candidate Core relationship vocabulary
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-001
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Candidate Relationship Registry

## Status

These entries are Proposed and cannot support an approved conformance claim until their definitions, domain/range, propagation, compatibility and ownership receive approval.

| Registry ID | Machine value | Meaning | Domain -> range | Owner contract | Relationship version | Cardinality | Propagation and inverse |
|---|---|---|---|---|---|---|---|
| `gaep.rel.targets` | `targets` | bounded work intends to affect a durable subject without asserting identity equivalence, current effect, approval, or authority | Initiative, Change -> Managed Asset | GAEP-CORE-001 | 1.0 | source 1..n; target 0..n | no automatic validity, state, approval, or authority effect; inverse `targeted-by` |
| `gaep.rel.governed-by-initiative` | `governed-by-initiative` | a Change belongs to the accountability and work scope of one bounded Initiative | Change -> Initiative | GAEP-CORE-001 | 1.0 | source exactly 1; target 0..n | no approval or authorization inheritance; inverse `governs-change` |
| `gaep.rel.contributes-to-change` | `contributes-to-change` | a Work Item implements, analyzes, or otherwise contributes to exactly one Change without becoming the Change or its authorization | Work Item -> Change | GAEP-CORE-001 | 1.0 | source exactly 1; target 0..n | the governing Initiative is derived through the Change; no effect, completion, approval, or authorization propagation; inverse `has-work-item` |
| `gaep.rel.decomposes-into` | `decomposes-into` | work is planned as smaller work while governance by an Initiative and contribution to a Change remain separate relationships | Initiative, Change, Work Item -> Work Item | GAEP-CORE-001 | 1.0 | source 0..n; child exactly one direct decomposition parent unless a profile permits shared work | not transitive by default; does not establish approval, authorization, or Change contribution; inverse `part-of-work` |
| `gaep.rel.affects` | `affects` | source has demonstrated material impact on target | Change, Effect -> Governed Resource | GAEP-CORE-001 | 1.0 | 0..n to 0..n | registered impact rule may create review/freshness/validity result; inverse `affected-by` |
| `gaep.rel.potentially-affects` | `potentially-affects` | impact is plausible but unresolved | Change, Effect -> Governed Resource | GAEP-CORE-001 | 1.0 | 0..n to 0..n | creates review candidate only; inverse `potentially-affected-by` |
| `gaep.rel.revises` | `revises` | revision succeeds an earlier revision in the same lineage | Resource Revision -> Resource Revision | GAEP-CORE-003 | 1.0 | source 0..n predecessors; same lineage required | ancestry only, no approval propagation; inverse `revised-by` |
| `gaep.rel.supersedes` | `supersedes` | source replaces target authority for an exact declared scope and effective time only after the required version-bound decision and approval are effective | Resource Revision, Baseline Set -> same type | GAEP-CORE-003 | 1.0 | source 0..n; target 0..n by disjoint scopes | may affect revision disposition only for the approved scope and time; proposed intent, mapping, or replacement text does not create this relationship; inverse `superseded-by` |
| `gaep.rel.represents` | `represents` | representation expresses an exact revision | Representation -> Resource Revision | GAEP-CORE-003 | 1.0 | representation exactly 1; revision 1..n | no state propagation; inverse `represented-by` |
| `gaep.rel.member-of-candidate-set` | `member-of-candidate-set` | exact revision is pinned in one candidate-set revision | Resource Revision -> Candidate Revision Set | GAEP-CORE-003 | 1.0 | revision 0..n; set 1..n through Candidate Set Membership | no approval, baseline, or authority propagation; inverse `contains-candidate-revision` |
| `gaep.rel.proposed-as-baseline` | `proposed-as-baseline` | proposal asks to designate one exact candidate-set revision | Baseline Proposal -> Candidate Revision Set | GAEP-CORE-003 | 1.0 | proposal exactly 1; set 0..n proposals | no authority until approved; inverse `baseline-proposed-by` |
| `gaep.rel.designates-baseline` | `designates-baseline` | approved baseline set designates one exact candidate-set revision | Baseline Set -> Candidate Revision Set | GAEP-CORE-003 | 1.0 | baseline exactly 1; set 0..n designations | scoped authority only through exact Approval Determination; inverse `designated-by-baseline` |
| `gaep.rel.member-of-baseline` | `member-of-baseline` | deprecated legacy alias for derived baseline designation | Resource Revision -> Baseline Set | GAEP-CORE-003 | legacy-0.1 | derived only; no direct writes | migrate through `member-of-candidate-set` plus `designates-baseline`; no independent propagation |
| `gaep.rel.references` | `references` | source points to target without stronger semantic assertion | Governed Resource -> Governed Resource | GAEP-CORE-003 | 1.0 | 0..n to 0..n | no impact propagation by default; inverse omitted |
| `gaep.rel.derived-from` | `derived-from` | source content was transformed from target; derivation alone does not assert identity or semantic equivalence, mapping fidelity, compatibility, or supersession | Resource Revision -> Resource Revision, External Resource | GAEP-CORE-003 | 1.0 | source 1..n; target 0..n | provenance and transformation method required; change may create freshness review; inverse `source-of-derivation` |
| `gaep.rel.summarizes` | `summarizes` | source is a lossy or compressed representation of targets | Resource Revision -> Resource Revision | GAEP-CORE-003 | 1.0 | source 1..n targets | omissions required; target change creates review candidate; inverse `summarized-by` |
| `gaep.rel.governed-by` | `governed-by` | source is subject to target rule or standing authority | Governed Resource -> Policy Rule, Authority Grant | GAEP-CORE-005 | 1.0 | source 1..n where governed; target 0..n | scope/time applicability only; never executable permission; inverse `governs` |
| `gaep.rel.constrained-by` | `constrained-by` | source must satisfy target constraint | Work, Governed Resource -> Policy Rule, Decision, Obligation | GAEP-CORE-005 | 1.0 | source 0..n; target 0..n | may block dependent authorization as declared; inverse `constrains` |
| `gaep.rel.approved-by` | `approved-by` | exact subject received an approval outcome for a declared purpose | Resource Revision, Candidate Revision Set, Baseline Proposal -> Approval Determination | GAEP-CORE-006 | 1.0 | subject 0..n determinations; determination exactly 1 case scope | no executable authority; outcome/scope/validity qualify link; inverse `approves-subject` |
| `gaep.rel.authorized-by` | `authorized-by` | exact action or effect is covered by a current executable grant | Action, Effect, Run -> Authorization Grant | GAEP-CORE-006 | 1.0 | action/effect exactly 1 applicable grant at commit, plus optional reinforcing grants | validity checked at effect time; inverse `authorizes` |
| `gaep.rel.authorization-derived-from` | `authorization-derived-from` | executable grant traces to a sufficient source | Authorization Grant -> Authority Grant, Policy Evaluation, Approval Determination, Decision, Policy Exception | GAEP-CORE-006 | 1.0 | grant 1..n sufficient sources | constraints intersect; permission never propagates directly from source; inverse `source-of-authorization` |
| `gaep.rel.excepted-by` | `excepted-by` | permitted variation is governed by exact exception | Obligation, Governed Resource -> Policy Exception | GAEP-CORE-005 | 1.0 | source 0..n; exception 1..n subjects | exception scope/validity apply; inverse `excepts` |
| `gaep.rel.asserts` | `asserts` | source states a claim | Principal, Governed Resource -> Claim | GAEP-CORE-007 | 1.0 | source 0..n; claim 1..n asserters | no proof or approval propagation; inverse `asserted-by` |
| `gaep.rel.supports-claim` | `supports-claim` | evidence is offered in support of a claim | Evidence Item -> Claim | GAEP-CORE-007 | 1.0 | 0..n to 0..n | strength and sufficiency assessed separately; inverse `supported-by` |
| `gaep.rel.contradicts-claim` | `contradicts-claim` | evidence materially opposes a claim | Evidence Item -> Claim | GAEP-CORE-007 | 1.0 | 0..n to 0..n | creates reassessment candidate; inverse `contradicted-by` |
| `gaep.rel.evaluates` | `evaluates` | exact run applies an epistemic procedure to a subject | Evaluation Run -> Claim, Evidence Item, Governed Resource | GAEP-CORE-007 | 1.0 | run 1..n subjects; subject 0..n runs | produces result only; inverse `evaluated-by` |
| `gaep.rel.produces-evaluation-result` | `produces-evaluation-result` | run produces one immutable epistemic result | Evaluation Run -> Evaluation Result | GAEP-CORE-007 | 1.0 | run exactly 1; result exactly 1 | no Review, approval, or authorization propagation; inverse `result-of-evaluation` |
| `gaep.rel.review-consumes-evaluation` | `review-consumes-evaluation` | Review considers an exact Evaluation Result | Review -> Evaluation Result | GAEP-CORE-006 | 1.0 | completed Review 1..n unless none-applicable rationale; result 0..n Reviews | no automatic sufficiency; inverse `consumed-by-review` |
| `gaep.rel.review-emits-conclusion` | `review-emits-conclusion` | completed Review emits its governed conclusion | Review -> Review Conclusion | GAEP-CORE-006 | 1.0 | exactly 1 per completed Review revision | conclusion does not approve or authorize; inverse `conclusion-of-review` |
| `gaep.rel.realizes` | `realizes` | concrete subject realizes an abstract design or contract | Implementation, Configuration -> Design, Contract | GAEP-CORE-012 | 1.0 | 0..n to 0..n | conformance not implied; inverse `realized-by` |
| `gaep.rel.implements` | `implements` | implementation claims to implement a requirement, decision, or interface | Implementation Revision -> Specification, Requirement, Decision | GAEP-CORE-012 | 1.0 | 0..n to 0..n | creates conformance-evaluation scope only; inverse `implemented-by` |
| `gaep.rel.depends-on` | `depends-on` | source requires target for declared behavior | Governed Resource -> Governed Resource | GAEP-CORE-003 | 1.0 | 0..n to 0..n | registered impact rule required; inverse `dependency-of` |
| `gaep.rel.consumes` | `consumes` | source uses target input or capability | Component, Workflow -> Data, Interface, Capability | GAEP-CORE-010 | 1.0 | 0..n to 0..n | no authority propagation; inverse `consumed-by` |
| `gaep.rel.provides` | `provides` | source offers target interface or capability | Component, Managed Asset -> Interface, Capability | GAEP-CORE-010 | 1.0 | 0..n to 0..n | no automatic inverse with consumption; inverse `provided-by` |
| `gaep.rel.invalidates` | `invalidates` | source makes target invalid for declared use | Event, Decision, Resource Revision -> Governed Resource | GAEP-CORE-004 | 1.0 | source 0..n; target 0..n | may transition validity only with reason/scope/authority; inverse `invalidated-by` |
| `gaep.rel.learned-from` | `learned-from` | generalized candidate learning originates in scoped evidence | Learning Candidate -> Evidence Item, Outcome | GAEP-CORE-007 | 1.0 | candidate 1..n sources | no promotion, policy, or authority propagation; inverse `source-of-learning` |

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REL-REQ-001 | A registered relationship SHALL identify canonical direction, domain, range, version, owner, cardinality constraints, propagation behavior and inverse where applicable. | Registry review |
| GAEP-REL-REQ-002 | A relationship SHALL NOT assert identity or semantic equivalence, mapping fidelity, compatibility, supersession effectiveness, approval, authorization, conformance, causation, or evidence strength beyond its registered semantics; relationship presence, traversal, or proposed intent SHALL NOT manufacture any of those meanings. | Misuse scenarios |
| GAEP-REL-REQ-003 | Extension relationships SHALL use an authority namespace and SHALL NOT reuse a Core machine value with changed meaning. | Namespace validation |
| GAEP-REL-REQ-004 | `realized_by` SHALL be treated as an unapproved legacy alias candidate for canonical `realizes`; migration direction SHALL be explicit before baseline. | Legacy migration review |
| GAEP-REL-REQ-005 | Relationship impact propagation SHALL produce an explicit review/freshness/validity result and SHALL NOT follow arbitrary graph reachability. | Impact traversal scenario |
| GAEP-REL-REQ-006 | Candidate Revision Set membership, Baseline Proposal, and Baseline Set designation SHALL use their separate registered relationships; legacy `member-of-baseline` SHALL NOT be directly authored. | Baseline-relationship migration test |
| GAEP-REL-REQ-007 | An `authorization-derived-from` source SHALL NOT be consumed as permission unless the exact current Authorization Grant also covers the action or effect. | Source-to-permission negative test |
| GAEP-REL-REQ-008 | Review-to-Evaluation relationships SHALL bind exact Evaluation Results and one Review Conclusion without treating either as Approval Determination or Authorization Grant. | Review-evaluation graph test |
