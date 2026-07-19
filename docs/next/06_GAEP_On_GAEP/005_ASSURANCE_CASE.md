---
id: GAEP-SELF-005
title: GAEP-on-GAEP Candidate Assurance Case
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Assurance Authority
scope: Evidence and assurance for readiness evaluation of a first bounded implementation slice
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-007
informative_references: []
supersedes: []
---

# GAEP-on-GAEP Candidate Assurance Case

## Top claim

**GAEP-CLAIM-000:** The GAEP Next candidate is sufficiently valuable, coherent, trustworthy, usable, portable, and operable for one bounded implementation slice to receive an Implementation Readiness Gate Evaluation.

Current Core claim assessment: **`not-assessed`**. No accountable evaluator has applied the declared evidence method to an exact candidate revision. This is the claim to be evaluated, not a conclusion.

## Case binding and authority

| Field | Current value |
|---|---|
| Document lineage and semantic version | `GAEP-SELF-005` at semantic version `0.1.0`; Proposed and not approved; no immutable Assurance Case Resource Revision exists |
| Exact subject | unresolved working-tree candidate; no immutable Candidate Revision Set revision or corpus digest exists |
| Declared use | determine whether an exact future candidate and bounded slice may receive an Implementation Readiness Gate Evaluation |
| Scope boundary | specification, product evidence, manual-pilot evidence, operating capability, and trust evidence for one bounded slice; no runtime, provider, deployment, or production claim is in current scope |
| Argument form | conjunctive critical-claim argument; Claims 001 through 011 must each receive an explicit applicable disposition |
| Accountable reviewer | GAEP Assurance Authority, unassigned |
| Approval references | none; no Approval Case or Approval Determination exists |
| Evidence index | required evidence classes are listed below; no Core-conforming Evidence Item inventory is yet bound to this case |
| Current validity for decision use | not established; this case cannot support a decision until exact subject, method, evaluator, evidence items, and validity interval are bound; claim assessment remains `not-assessed` |

## Claim decomposition

| Claim ID | Claim | Required evidence | Evidence readiness | Current Core claim assessment |
|---|---|---|---|---|
| GAEP-CLAIM-001 | A defined target user has a recurring problem worth solving | interviews, historical cases, baseline workflow measures, alternatives assessment | missing | `not-assessed` |
| GAEP-CLAIM-002 | The proposed first workflow produces material value | manual Product and non-Product pilots, comparison, repeat willingness | missing | `not-assessed` |
| GAEP-CLAIM-003 | Governance burden is proportionate | author/reviewer/steward effort, latency, duplicate-work analysis | missing | `not-assessed` |
| GAEP-CLAIM-004 | Core semantics are coherent and profile-independent | ontology review, registry checks, dependency DAG, scenario results | candidate structural evidence exists; independent evaluation missing | `not-assessed` |
| GAEP-CLAIM-005 | Decisions and approvals are attributable and version-bound | identity/delegation/authorization scenarios and threat review | candidate contracts exist; accountable evaluation missing | `not-assessed` |
| GAEP-CLAIM-006 | Security; data, privacy, and records; AI; operational reliability; audit integrity and accountability; incident response and continuity; legal, IP, and supplier; and workforce trust, accessibility, and ethics risks are controlled for the first slice where applicable | exact profile-selection manifest with approved selections or justified non-selections; threat and data inventories; supplier, legal, participant, and accessibility assessments; reliability and continuity objectives; negative scenarios; exact residual-risk decisions | missing | `not-assessed` |
| GAEP-CLAIM-007 | Evidence supports decisions without overstating certainty | claim/evidence assessments, conflict and invalidation scenarios | candidate model exists; scenario and independence evidence missing | `not-assessed` |
| GAEP-CLAIM-008 | The model remains usable without one AI provider or centralized runtime | manual path and provider-replacement scenario | missing | `not-assessed` |
| GAEP-CLAIM-009 | External authority and multi-repository trace remain reliable | inaccessible-source, mapping-loss and federation scenarios | missing | `not-assessed` |
| GAEP-CLAIM-010 | GAEP can be sustained and governed | named owners, capacity, support, funding and change control | missing | `not-assessed` |
| GAEP-CLAIM-011 | The candidate corpus conforms to its own rules | metadata, requirement, registry, link, dependency and review evidence | deterministic checks are partial evidence; independent semantic review missing | `not-assessed` |

## Explicit argument and defeater map

The warrant for the top claim is conjunctive: value without trust is insufficient, trust without usability is insufficient, and structural consistency without product or operational evidence is insufficient. No claim is supported merely because its required evidence is named.

| Claim ID | Warrant connecting evidence to the top claim | Current evidence and argument result | Material assumptions and dependencies | Counter-evidence, defeaters, and residual uncertainty |
|---|---|---|---|---|
| GAEP-CLAIM-001 | Independent problem and alternative evidence showing a recurring costly problem in a bounded cohort would support that there is a legitimate product reason to proceed. | no Core Evidence Items; branch `not-assessed` | representative cohort, valid research method, lawful participation, and credible comparison | no interviews or historical-case evaluation; the problem theory is mainly author and corpus inference; residual demand uncertainty is unbounded |
| GAEP-CLAIM-002 | Repeated manual cases that improve a selected workflow against a baseline without unacceptable harms would support material value for that scope. | no pilot result; branch `not-assessed` | first user/workflow selection, usable manual procedure, comparable cases, and predeclared outcomes | no first workflow or external pilot; self-application cannot establish transfer or willingness to repeat |
| GAEP-CLAIM-003 | Measured displaced work, total added effort, latency, and participant burden within declared budgets would support proportionality. | candidate metric definitions only; branch `not-assessed` | complete time/cost capture, anti-gaming controls, representative reviewers, and explicit displaced work | Core and Profile size already exceed candidate simplicity budgets; no burden baseline or comprehension result exists |
| GAEP-CLAIM-004 | Independent ontology, dependency, negative-case, and cross-domain scenarios with no material contradiction would support coherent profile-independent semantics. | validator and candidate contracts are partial inputs; branch `not-assessed` | Core contraction preserves invariants and scenarios cover materially different domains and realizations | 12 contracts, 353 requirements, 70 Core Open Decisions, four normative conflicts, and 13 extraction/defer rows remain; semantic integration is incomplete |
| GAEP-CLAIM-005 | Identity, delegation, decision, approval, policy, and grant scenarios that preserve exact versions and deny escalation would support accountable authority semantics. | candidate contracts and negative cases only; branch `not-assessed` | valid Principal assignments, authority sources, time, policy, and realistic adversarial scenarios | every concrete role and authority is unassigned; no operational or independent scenario evidence exists |
| GAEP-CLAIM-006 | Exact profile selections plus domain assessments, controls, negative scenarios, and residual-risk decisions would support bounded trustworthiness for the slice. | profiles and risk records are candidate structure; branch `not-assessed` | correct applicability, competent independent authorities, complete threat/data/supplier/participant scope, and valid risk method | Profile Selection Manifest is unresolved; security, data, AI, operational, audit, incident, legal, supplier, workforce, accessibility, and ethics evidence is missing |
| GAEP-CLAIM-007 | Claim-scoped evidence assessments retaining adverse results, conflicts, limits, and invalidation would support honest decision use. | candidate Claim/Evidence model only; branch `not-assessed` | attributable sources, valid methods, evidence integrity, independence, and decision-maker comprehension | no bound evidence inventory or independent evaluation; self-authored structure may reinforce its own assumptions |
| GAEP-CLAIM-008 | A successful manual path and provider replacement using equivalent governed meaning would support portability and no mandatory AI dependency. | no executed continuity or replacement scenario; branch `not-assessed` | equivalent task scope, declared losses, reproducible inputs, and available non-provider path | exact current provider/model facts are incomplete and future adapter behavior is hypothetical |
| GAEP-CLAIM-009 | Version-bound external mappings and federation scenarios preserving authority, freshness, loss, and degraded states would support reliable distributed trace. | candidate external-reference and workspace contracts only; branch `not-assessed` | cooperative authority domains, stable identifiers, lawful snapshots, resolver availability, and declared conflict rules | no federation pilot; external sources are not version- or rights-assessed; inaccessible and divergent-source behavior is untested |
| GAEP-CLAIM-010 | Named accountable owners, funded capacity, support, change control, incident response, and retirement capability would support sustainability. | candidate operating model only; branch `not-assessed` | legitimate appointing organization, adequate skills/capacity, funding, succession, and stop authority | sponsor, organization, all assignments, funding, support capacity, and succession remain absent |
| GAEP-CLAIM-011 | Deterministic validation plus independent semantic, usability, rights, and migration review against an exact revision would support corpus conformance for the declared class. | validator passes 79 documents and 955 requirement definitions with zero warnings; branch still `not-assessed` | validator coverage is correct, exact revision is immutable, and independent review can reproduce results | static checks cannot prove semantic correctness; no immutable Candidate Revision Set, independent conclusion, rights review, or migration rehearsal exists |

The current argument therefore has no supported path to `GAEP-CLAIM-000`. This is an absence-of-evaluation conclusion, not evidence that the product is impossible or a silent conversion to `not-supported`.

## Cross-cutting assumptions and dependencies

- an immutable Candidate Revision Set can be assembled without hiding exclusions or unresolved conflicts;
- a real target cohort, workflow, comparison baseline, and lawful research method can be selected;
- Core can be reduced within its complexity budget without collapsing required semantic distinctions;
- qualified, sufficiently independent reviewers and domain authorities can be assigned;
- exact source, provider, data, rights, supplier, jurisdiction, and external-authority facts can be obtained;
- manual and non-Product scenarios can produce reproducible evidence before implementation;
- unfavorable evidence, dissent, invalidation, and stop decisions will remain visible.

Failure of an assumption reopens the affected claims; an assumption is not evidence.

## Current material defeaters

- absent external problem, user, workflow, and repeat-use evidence;
- 59 unresolved Product Strategy decisions and 70 registered Core Open Decisions;
- Core complexity-budget failure and open extraction work;
- unassigned sponsor, owners, assessors, approvers, and authorities;
- unresolved Profile Selection Manifest and no effective configuration;
- incomplete AI-authoring provenance, data inventory, rights, supplier, legal, and jurisdiction evidence;
- no manual pilot, independent semantic review, migration rehearsal, or implementation-slice definition.

These defeaters block a supported assurance conclusion. They are not averaged, waived by prose, or erased by a passing static check.

## Evidence quality

Evidence is assessed for relevance, subject/revision binding, method validity, independence, completeness, recency, integrity, classification, reproducibility limits, known conflicts, and expiry conditions. Self-authored documents demonstrate intent, not product value or operational effectiveness.

The only permitted Claim Assessment results are `not-assessed`, `supported`, `partially-supported`, `not-supported`, and `inconclusive`. Evidence readiness labels such as `missing` or `candidate evidence exists` are inventory descriptions, not Claim Assessment results.

## Decision rule

The top claim cannot be supported by averaging away a failed critical claim. Claims 001 through 011 are candidate critical claims, including evidence integrity/decision honesty in Claim 007 and external-authority/federation reliability in Claim 009. A profile may establish that a claim is conditionally non-applicable only through explicit scope, rationale, authority, evidence, consequence, and review trigger.

The GAEP Assurance Authority, once legitimately assigned, may refine the critical-claim rule before evaluation. Changing it after observing results requires a new Decision Record that preserves the prior rule, rationale, dissent, bias risk, and consequence; it cannot silently convert a failed critical claim into an acceptable aggregate score.

## Review, expiry, and invalidation

This case must be revised and reassessed when any of the following changes materially:

- Candidate Revision Set membership, digest, dependency, migration disposition, or Core/Profile semantics;
- target segment, user, problem, workflow, product form, distribution, bounded slice, or success/stop criterion;
- claim, evidence, method, data, evaluation environment, reviewer identity, competence, independence, or criticality rule;
- Profile Selection Manifest, effective policy, effective configuration, threat, risk, exception, obligation, approval, or authorization;
- AI use, provider, model, context, autonomy, data flow, supplier terms, jurisdiction, rights, or external authority;
- operating owner, funding, support, incident/continuity capability, or participant-protection boundary.

No approved validity interval or expiry exists. This working case expires before any gate or decision use and at the first trigger above, whichever comes first. Reassessment creates a new traceable revision and preserves this case, its adverse evidence, and prior assessments rather than overwriting them.
