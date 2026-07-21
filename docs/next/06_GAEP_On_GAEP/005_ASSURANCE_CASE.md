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

Current Core claim assessment: **`not-assessed`**. No exact candidate evaluation subject is bound, and no assigned GAEP Assurance Authority or GAEP Independent Reviewer has applied the declared evidence method. This is the claim to be evaluated, not a conclusion.

## Case binding and authority

| Field | Current value |
|---|---|
| Document lineage and semantic version | `GAEP-SELF-005` at semantic version `0.1.0`; Proposed and not approved; this authoring change is not yet an immutable Assurance Case Resource Revision |
| Batch 1 input checkpoint | accepted commit `0719efb75b09c8704d08385d6cd61541fd9c614c`; exact input for the current Batch 2A authoring work, not the subject of the post-checkpoint claims below |
| Current mutable Batch 2A authoring subject | working-tree changes to `GAEP-SELF-001`, `GAEP-SELF-002`, `GAEP-SELF-005`, `GAEP-SELF-009`, and `GAEP-REG-008`, derived from the Batch 1 checkpoint; not committed, immutable, or bound by this case to a final corpus digest |
| Candidate evaluation subject | unbound; must later identify one exact immutable candidate revision, included and excluded paths, dependencies, and corpus digest before any Claim Assessment or decision use |
| Structural-observation subject | Batch 1 checkpoint `0719efb75b09c8704d08385d6cd61541fd9c614c` only, as detailed below; the worktree was clean and synchronized with `origin/feature/rethink` when that observation was made |
| Formal revision designations | no Candidate Revision Set, Candidate Revision Set corpus digest, Baseline Proposal, or Baseline Set exists; an exact Git commit does not create any of them |
| Current working semantic interpretation | Product is interpreted as a long-lived Managed Asset and Initiative as bounded governed work affecting one or more Managed Assets, according to the `GAEP-DEC-007` Option B selection at the checkpoint; current Batch 2A drafts treat `urn:gaep:candidate:product:gaep` only as a provisional local Product identity candidate whose exact boundary, target relation, baseline or genesis, and namespace authority remain unresolved |
| Declared use | determine whether an exact future candidate and bounded slice may receive an Implementation Readiness Gate Evaluation |
| Scope boundary | specification, product evidence, manual-pilot evidence, operating capability, and trust evidence for one bounded slice; no runtime, provider, deployment, or production claim is in current scope |
| Argument form | conjunctive critical-claim argument; Claims 001 through 011 must each receive an explicit applicable disposition |
| Accountable reviewer | GAEP Assurance Authority, unassigned |
| GAEP Independent Reviewer | unassigned; no independent semantic or assurance conclusion exists |
| Authority state | proposed closure-work Role Assignments and an authority-source declaration are recorded, but none is accepted or effective and no standing Authority Grant exists; Candidate Baseline Approver, GAEP Independent Reviewer, and GAEP Assurance Authority remain explicitly unassigned |
| Approval references | none; no Approval Case or Approval Determination exists |
| Evidence index | required evidence classes are listed below; no Core-conforming Evidence Item inventory is yet bound to this case |
| Current validity for decision use | not established; this case cannot support a decision until exact subject, method, evaluator, evidence items, and validity interval are bound; claim assessment remains `not-assessed` |

## Product, work, applicability, and compatibility boundary

For candidate-closure analysis, this case distinguishes the enduring governed subject from the work that affects it:

- Product is a long-lived Managed Asset whose identity and operational lifetime are independent of any one Initiative;
- Initiative is bounded governed work that may target one or more Managed Assets, and one Product may be targeted by several Initiatives;
- Change is a versioned delta against exact subject baselines or an explicit genesis/no-prior-baseline declaration, while proposal, decision, approval, authorization, and execution remain separate; Work Item is a planned or executable unit of exactly one Change and derives its governing Initiative through that Change;
- Initiative closure does not retire a Product, and Product retirement does not erase Initiative, Change, Work Item, decision, evidence, or relationship history;
- Product Development Profile applicability is evaluated against exact Product and Initiative identities. `GAEP-SELF-002` records applicability as `unresolved` and separately records proposed obligation strength `required` if applicability resolves positively; the provisional identity or trigger hypothesis does not itself become Profile selection, effectiveness, activation, approval, or authorization.

The selected compatibility direction is versioned mapping with staged dual-read and no initial dual-write. Legacy records retain their original Product-as-Initiative meaning for historical and legacy-consumer interpretation. Candidate representations require explicit source and target versions, mapping method, mapping-fidelity assessment, compatibility results by dimension, consumer scope, ambiguity, loss, rollback, and historical-reconstruction treatment. Mapping fidelity, compatibility, representation strategy, migration disposition, constitutional supersession, approval, and authorization remain separate. No mapping, derived view, scenario definition, or positive structural result makes the legacy Constitution superseded or authorizes migration.

## Claim decomposition

| Claim ID | Claim | Required evidence | Evidence readiness | Current Core claim assessment |
|---|---|---|---|---|
| GAEP-CLAIM-001 | A defined target user has a recurring problem worth solving | interviews, historical cases, baseline workflow measures, alternatives assessment | missing | `not-assessed` |
| GAEP-CLAIM-002 | The proposed first workflow produces material value | manual Product and non-Product pilots, comparison, repeat willingness | missing | `not-assessed` |
| GAEP-CLAIM-003 | Governance burden is proportionate | author/reviewer/steward effort, latency, duplicate-work analysis | missing | `not-assessed` |
| GAEP-CLAIM-004 | Core semantics coherently distinguish durable Managed Assets, including Product, from bounded Initiative, Change, and Work Item semantics without Profile-dependent identity collapse | ontology review, identity/cardinality/lifetime/state-allocation scenarios, registry checks, dependency DAG, and negative-case results | working contraction and self-authored paper scenarios exist; independent reproduction, effective semantic Decisions, and exact-set evaluation are missing | `not-assessed` |
| GAEP-CLAIM-005 | Decisions, approvals, authority, and authorization are attributable, version-bound, and do not arise from authorship, relationships, proposed assignments, or semantic selection alone | identity, assignment, delegation, decision-effectiveness, approval, authorization and escalation scenarios plus threat review | candidate contracts, controlled role definitions, and proposed assignment records exist; acceptance, effective assignments, a standing authority grant, and accountable evaluation are missing | `not-assessed` |
| GAEP-CLAIM-006 | Security; data, privacy, and records; AI; operational reliability; audit integrity and accountability; incident response and continuity; legal, IP, and supplier; and workforce trust, accessibility, and ethics risks are controlled for the first slice where applicable | exact profile-selection manifest with approved selections or justified non-selections; threat and data inventories; supplier, legal, participant, and accessibility assessments; reliability and continuity objectives; negative scenarios; exact residual-risk decisions | missing | `not-assessed` |
| GAEP-CLAIM-007 | Evidence supports decisions without overstating certainty | claim/evidence assessments, conflict and invalidation scenarios | candidate model exists; scenario and independence evidence missing | `not-assessed` |
| GAEP-CLAIM-008 | The model remains usable without one AI provider or centralized runtime | manual path and provider-replacement scenario | missing | `not-assessed` |
| GAEP-CLAIM-009 | External authority, legacy/candidate compatibility, mapping fidelity, and multi-repository trace remain reliable without silent identity equivalence or dual-write | inaccessible-source, legacy-only/candidate-only consumer, mapping-loss, staged-dual-read, rollback, historical-reconstruction and federation scenarios | candidate mapping rules plus a synthetic reversible paper rehearsal exist; no real-fixture, external-system, consumer, or federation evidence exists | `not-assessed` |
| GAEP-CLAIM-010 | GAEP can be sustained and governed | named owners, capacity, support, funding and change control | missing | `not-assessed` |
| GAEP-CLAIM-011 | The exact candidate corpus conforms to its declared structural and semantic rules | exact-revision metadata, requirement, registry, link, dependency, semantic-scenario and independent-review evidence | mode-aware structural/candidate checks and deterministic manifest mechanics exist; a clean exact Candidate Revision Set, independent review, and semantic conclusion are missing | `not-assessed` |

## Exact structural validation observation

The following observation was produced before this Assurance Case authoring edit, while the worktree exactly matched the Batch 1 checkpoint. It is evidence about that checkpoint only. It does not validate this uncommitted Batch 2A authoring change and is not yet a Core-conforming immutable Evidence Item.

| Field | Observed value |
|---|---|
| Subject repository and commit | GAEP repository, commit `0719efb75b09c8704d08385d6cd61541fd9c614c` |
| Subject condition | clean worktree; local branch synchronized with `origin/feature/rethink` |
| Validator | `scripts/validate_next_docs.rb`; SHA-256 `36921a497a1130edfb2a6e2431610e6c8f2b982b86d3f4be58033cf7012c7640` |
| Runtime | Ruby `2.6.10p210` on `universal.arm64e-darwin25` |
| Commands | `ruby scripts/validate_next_docs.rb` and a second execution prefixed with `GAEP_STRICT_VALIDATION=1` |
| Exit and output integrity | both executions exited `0`; each exact output SHA-256 was `13d9308f471ceb3178241ddcbdf89110ca3c3c6dee0d5912fce4b10386dfa58f` |
| Structural result | 79 documents; 79 document IDs; 955 requirement definitions; 44 legacy documents mapped; 59 Product Strategy decisions crosswalked; 70 Core Open Decisions; 50 Repository gaps; zero warnings; `PASS` |
| Coverage limitation | structural metadata, ID, dependency, link, requirement, legacy-map, decision-crosswalk and gap-register checks performed by the exact validator; the validator does not currently consume `GAEP_STRICT_VALIDATION`, so the second execution is not evidence of a distinct strict-mode contract; no independent semantic, product-value, authority-validity, constitutional, compatibility-rehearsal, baseline, pilot, readiness, runtime, or operational evaluation |
| Invalidation | any material subject-file, validator, validation-mode, runtime, registry, dependency, semantic, inclusion/exclusion, or evidence-method change requires a new exact observation |

This structural `PASS` does not support a semantic-closure, constitutional-effectiveness, Profile-activation, Candidate Revision Set, baseline-readiness, pilot-readiness, implementation-readiness, approval, or authorization claim.

## Current working-candidate evidence

The evidence below is newer than the immutable historical observation above but remains author-produced working evidence. It is deliberately not promoted to a Core Evidence Item or Claim Assessment because the repository is dirty, the full closure set is not formally assembled, and no competent independent evaluator or effective GAEP Assurance Authority has assessed it.

| Working evidence | Current observation | Limitation |
|---|---|---|
| Core contraction | 8 active Core contracts, 160 active Core requirements, maximum 24, and 48 provisional concept types; 135 omitted former requirements have one exact disposition and the 13 extraction rows name current targets | target acceptance, semantic correctness, and the 70 Open Decisions remain unresolved; numeric compliance alone supports no conformance or readiness claim |
| Decision classification | all 70 Core Open Decisions have exactly one T0-T3 classification: 18 T0, 29 T1, 19 T2, and 4 T3 | every status remains open; classification is neither an answer nor an approved deferral |
| Paper scenarios | `GAEP-PAPER-001` binds a normalized 47-file semantic input aggregate SHA-256 `1bae309eb7e937dc8f82acfbd26d4c9d4046f5ed2ec4ac661f7643f710b9adea` and records 21 paper passes, 11 passes with blockers, and 4 inconclusive cases | self-authored static walkthrough; result sections are excluded from the subject digest to avoid self-reference; no operational or independent pass |
| Migration rehearsal | `GAEP-MIG-REH-001` records seven synthetic cases covering split, ambiguity, loss, consumer views, dual-write denial, and rollback | no real legacy record, consumer, external system, routing, or recovery mechanism was exercised |
| GAEP-on-GAEP rehearsal | `GAEP-SELF-REH-001` records all 10 manual workflow steps and correctly stops before Decision effectiveness, Approval, Authorization, baseline transition, participant activity, or implementation | no new participant comprehension, repeat value, quantified burden, transfer, or independent-review evidence |
| Candidate-set mechanics | the builder rejects dirty formal assembly and can emit an explicitly non-formal, no-effect draft snapshot; the validator has cumulative structural, candidate, baseline, and implementation-readiness modes | no formal manifest has been created; current validation output is tied to mutable working content and is not clean-revision gate evidence |
| Gate observations | structural and candidate modes pass their machine-checkable scopes; baseline and implementation-readiness modes return `BLOCKED` with separated governance prerequisites | a correctly blocked gate is not approval, failure proof, or authorization |

These observations narrow some structural uncertainty but do not change any Claim Assessment from `not-assessed`.

## Explicit argument and defeater map

The warrant for the top claim is conjunctive: value without trust is insufficient, trust without usability is insufficient, and structural consistency without product or operational evidence is insufficient. No claim is supported merely because its required evidence is named.

| Claim ID | Warrant connecting evidence to the top claim | Current evidence and argument result | Material assumptions and dependencies | Counter-evidence, defeaters, and residual uncertainty |
|---|---|---|---|---|
| GAEP-CLAIM-001 | Independent problem and alternative evidence showing a recurring costly problem in a bounded cohort would support that there is a legitimate product reason to proceed. | no Core Evidence Items; branch `not-assessed` | representative cohort, valid research method, lawful participation, and credible comparison | no interviews or historical-case evaluation; the problem theory is mainly author and corpus inference; residual demand uncertainty is unbounded |
| GAEP-CLAIM-002 | Repeated manual cases that improve a selected workflow against a baseline without unacceptable harms would support material value for that scope. | no pilot result; branch `not-assessed` | first user/workflow selection, usable manual procedure, comparable cases, and predeclared outcomes | no first workflow or external pilot; self-application cannot establish transfer or willingness to repeat |
| GAEP-CLAIM-003 | Measured displaced work, total added effort, latency, and participant burden within declared budgets would support proportionality. | candidate metric definitions and qualitative self-rehearsal burden findings only; branch `not-assessed` | complete time/cost capture, anti-gaming controls, representative reviewers, and explicit displaced work | numeric Core budgets now pass, but 19 Profiles contain 244 requirements including 76 repeated rows, 70 Decisions remain open, and no burden baseline or comprehension result exists |
| GAEP-CLAIM-004 | Independent ontology, dependency, identity/cardinality/lifetime/state-allocation, negative-case, and cross-domain scenarios with no material contradiction would support coherent profile-independent semantics. | the working 8/160/24/48 contraction, stable-ID dispositions, Option B propagation, and `GAEP-PAPER-001` exist; branch `not-assessed` | the pending semantic decision becomes effective through valid authority records, retained and extracted invariants survive independent review, and scenarios cover materially different domains and Realizations | the walkthrough is self-authored; 70 Core Decisions remain open, including 18 baseline-semantic T0 Decisions and four current-contract conflicts; extracted Profile applicability and target acceptance, constitutional approval, and independent review are absent |
| GAEP-CLAIM-005 | Identity, assignment, delegation, decision-effectiveness, approval, policy, and grant scenarios that preserve exact versions and deny escalation would support accountable authority semantics. | the current mutable Batch 2A subject drafts proposed assignments, newly controlled role definitions, approval-authority separation, and an authority-source declaration; no Role Assignment is effective, no standing Authority Grant exists, and no accountable evaluation exists; branch `not-assessed` | a stabilized exact subject, canonical Principal and role records, explicit acceptance, effective time, authority source, standing grant, scope, conflict disclosure, independence limits, policy, and realistic adversarial scenarios | selected closure-work assignments remain proposed and ineffective; Candidate Baseline Approver, GAEP Independent Reviewer, and GAEP Assurance Authority are unassigned; no operational or independent scenario evidence exists |
| GAEP-CLAIM-006 | Exact profile selections plus domain assessments, controls, negative scenarios, and residual-risk decisions would support bounded trustworthiness for the slice. | profiles and risk records are candidate structure; branch `not-assessed` | correct applicability, competent independent authorities, complete threat/data/supplier/participant scope, and valid risk method | no conforming Profile Selection Manifest exists; applicability remains unresolved; `required` is only the proposed obligation strength if identity, target, baseline or genesis, and governed applicability later resolve positively; security, data, AI, operational, audit, incident, legal, supplier, workforce, accessibility, and ethics evidence is missing |
| GAEP-CLAIM-007 | Claim-scoped evidence assessments retaining adverse results, conflicts, limits, and invalidation would support honest decision use. | candidate Claim/Evidence model plus self-authored scenario and gate limitations; branch `not-assessed` | attributable sources, valid methods, evidence integrity, independence, and decision-maker comprehension | no approved Evidence Item inventory or independent evaluation; self-authored structure and walkthroughs may reinforce their own assumptions |
| GAEP-CLAIM-008 | A successful manual path and provider replacement using equivalent governed meaning would support portability and no mandatory AI dependency. | no executed continuity or replacement scenario; branch `not-assessed` | equivalent task scope, declared losses, reproducible inputs, and available non-provider path | exact current provider/model facts are incomplete and future adapter behavior is hypothetical |
| GAEP-CLAIM-009 | Version-bound legacy/candidate and external mappings plus federation scenarios preserving authority, source meaning, mapping fidelity, compatibility by dimension, freshness, loss, rollback, and degraded states would support reliable distributed trace. | staged dual-read, no-initial-dual-write, mapping-fidelity, consumer, rollback, and historical-reconstruction rules plus seven synthetic rehearsal cases exist; branch `not-assessed` | exact source/target revisions, lawful snapshots, stable identifiers, declared read authority, single-write authority, resolver availability, and conflict rules | no real-fixture migration, consumer, external-reference, federation, routing, or operational rollback evidence; external sources are not version- or rights-assessed |
| GAEP-CLAIM-010 | Named accountable owners, funded capacity, support, change control, incident response, and retirement capability would support sustainability. | the current mutable Batch 2A subject drafts bounded closure-work assignments, but they are not accepted or effective; candidate operating model only; branch `not-assessed` | a stabilized exact subject, legitimate appointing organization, accepted assignments, adequate skills/capacity, funding, succession, and stop authority | Organization Scope authority and the Authority Namespace issuer remain unresolved; proposed assignments are ineffective; assurance, independent-review, baseline-approval and many domain authorities remain unassigned; funding, support capacity, backup, and succession remain absent |
| GAEP-CLAIM-011 | Deterministic validation plus independent semantic, usability, rights, and migration review against an exact revision would support corpus conformance for the declared class. | current structural and candidate modes pass their machine-checkable scope; manifest assembly is deterministic and fail-closed for dirty formal input; branch still `not-assessed` | validator scope and implementation are fit, a clean exact set is reproducible, and independent review can reproduce and extend the result | machine checks and self-rehearsals cannot prove semantic correctness, authority validity, Product value, compatibility, or readiness; no formal Candidate Revision Set, independent conclusion, rights review, or assurance evaluation exists |

The current argument therefore has no supported path to `GAEP-CLAIM-000`. This is an absence-of-evaluation conclusion, not evidence that the product is impossible or a silent conversion to `not-supported`.

## Cross-cutting assumptions and dependencies

- an immutable Candidate Revision Set can be assembled without hiding exclusions or unresolved conflicts;
- the provisional GAEP Product identity, product-family boundary, target relationship, and baseline or genesis can be resolved without inventing scope or activating a Profile;
- the accepted Product/Initiative interpretation can be propagated without silently changing legacy authority, collapsing subject identity, activating a Profile, or overstating `GAEP-DEC-007` effectiveness;
- staged dual-read can preserve legacy and candidate consumer meaning without dual-write, split authority, hidden loss, or unrecoverable history;
- a real target cohort, workflow, comparison baseline, and lawful research method can be selected;
- the numeric Core contraction can survive independent semantic review without collapsed invariants or rejected extraction targets;
- qualified, sufficiently independent reviewers and domain authorities can be assigned;
- exact source, provider, data, rights, supplier, jurisdiction, and external-authority facts can be obtained;
- manual and non-Product scenarios can produce reproducible evidence before implementation;
- unfavorable evidence, dissent, invalidation, and stop decisions will remain visible.

Failure of an assumption reopens the affected claims; an assumption is not evidence.

## Current material defeaters

- absent external problem, user, workflow, and repeat-use evidence;
- 59 unresolved Product Strategy decisions and 70 registered Core Open Decisions;
- numeric Core closure is self-authored working evidence only; 70 Core Decisions remain open, extracted targets are unapproved, and independent semantic review is absent;
- `GAEP-DEC-007` effectiveness pending, constitutional supersession unapproved, and Product/Initiative semantic propagation and compatibility evidence incomplete;
- proposed closure-work assignments that are not yet accepted or effective, unresolved Organization Scope authority and Authority Namespace issuer, and unassigned GAEP Assurance Authority, GAEP Independent Reviewer, Candidate Baseline Approver, and required domain authorities;
- provisional GAEP Product identity and target relation, only an unresolved pre-resolution Profile worksheet, no conforming Profile Selection Manifest, and no effective configuration;
- incomplete AI-authoring provenance, data inventory, rights, supplier, legal, and jurisdiction evidence;
- paper scenarios, a synthetic migration rehearsal, and a GAEP-on-GAEP documentation rehearsal exist only as self-authored evidence; four scenarios remain inconclusive and there is no independent semantic review, real-fixture migration/federation result, participant pilot, or implementation-slice definition.

These defeaters block a supported assurance conclusion. They are not averaged, waived by prose, or erased by a passing static check.

## Evidence quality

Evidence is assessed for relevance, subject/revision binding, method validity, independence, completeness, recency, integrity, classification, reproducibility limits, known conflicts, and expiry conditions. Self-authored documents demonstrate intent, not product value or operational effectiveness.

The only permitted Claim Assessment results are `not-assessed`, `supported`, `partially-supported`, `not-supported`, and `inconclusive`. Evidence readiness labels such as `missing` or `candidate evidence exists` are inventory descriptions, not Claim Assessment results.

## Decision rule

The top claim cannot be supported by averaging away a failed critical claim. Claims 001 through 011 are candidate critical claims, including evidence integrity/decision honesty in Claim 007 and external-authority/federation reliability in Claim 009. A profile may establish that a claim is conditionally non-applicable only through explicit scope, rationale, authority, evidence, consequence, and review trigger.

The GAEP Assurance Authority, once legitimately assigned and supported by a current scoped standing Authority Grant for that decision class, may refine the critical-claim rule before evaluation. Changing it after observing results requires a new Decision Record that preserves the prior rule, rationale, dissent, bias risk, and consequence; it cannot silently convert a failed critical claim into an acceptable aggregate score. No conforming Profile Selection Manifest exists for the current candidate, applicability remains unresolved, and `required` is only the proposed obligation strength if identity, target, baseline or genesis, and governed applicability later resolve positively. Those conditions do not by themselves make the Product Development Profile selected, effective, approved, or authorized; an exact Profile Selection Manifest and valid authority remain separate inputs.

## Review, expiry, and invalidation

This case must be revised and reassessed when any of the following changes materially:

- Candidate Revision Set membership, digest, dependency, migration disposition, or Core/Profile semantics;
- Product, Managed Asset, Initiative, Change, Work Item, target cardinality, state ownership, Profile-applicability, mapping-fidelity, compatibility, staged-dual-read, dual-write-prohibition, rollback, or historical-interpretation semantics;
- Role Assignment creation, acceptance, effectiveness, expiry, revocation, delegation, authority source, Organization Scope, Authority Namespace, acting role, conflict, independence, backup, or succession;
- target segment, user, problem, workflow, product form, distribution, bounded slice, or success/stop criterion;
- claim, evidence, method, data, evaluation environment, reviewer identity, competence, independence, or criticality rule;
- Profile Selection Manifest, effective policy, effective configuration, threat, risk, exception, obligation, approval, or authorization;
- AI use, provider, model, context, autonomy, data flow, supplier terms, jurisdiction, rights, or external authority;
- operating owner, funding, support, incident/continuity capability, or participant-protection boundary.

No approved validity interval or expiry exists. This working case expires before any gate or decision use and at the first trigger above, whichever comes first. Reassessment creates a new traceable revision and preserves this case, its adverse evidence, and prior assessments rather than overwriting them.
