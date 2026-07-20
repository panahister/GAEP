---
id: GAEP-SELF-009
title: GAEP Stakeholder and Role Assignment
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: Candidate role inventory and proposed authority assignments for feature/rethink documentation closure work
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-001
informative_references: []
supersedes: []
---

# GAEP Stakeholder and Role Assignment

## Candidate operating role inventory

This document contains both exact candidate role types registered in `GAEP-REG-008` and unresolved GAEP operating-role proposals retained for later mapping. A label is canonical only when its exact value resolves to a registry ID; the table does not silently alias a GAEP-prefixed proposal to a similar generic role. The bounded Role Assignments below use only registered IDs. No proposed assignment is currently effective: each requires an exact record revision, explicit acceptance by the named Human Principal, and a contemporaneously recorded effective time. Authorship, repository ownership, file metadata, tool access, or this draft alone does not assign a role or create authority.

| Role | Accountability | Current assignment |
|---|---|---|
| GAEP Investment Sponsor | continued investment, strategic risk, organizational mandate and funding | unassigned; candidate operating label, registry mapping unresolved; not an alias for GAEP Initiative Sponsor |
| GAEP Initiative Sponsor | bounded Initiative scope, priority, resources, narrowing, pause and stop | `GAEP-RA-001` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Product Owner | target user, problem evidence, first workflow, value and scope | `GAEP-RA-002` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Product Research Owner | research ethics, problem evidence, pilot design and evidence limitations | unassigned |
| GAEP Constitutional Owner | constitutional interpretation, approval and amendment authority | `GAEP-RA-006` proposed for `mehdi-panahi`; not effective pending explicit acceptance; no constitutional approval exists |
| GAEP Decision and Authorization Steward | separation and integrity of decisions, approvals, grants and effect boundaries | unassigned |
| GAEP Distribution and Ecosystem Owner | distribution mode, contribution, conformance marks and ecosystem boundary | unassigned |
| GAEP Specification Steward | corpus integrity, terminology, requirements, compatibility and baseline coordination | `GAEP-RA-003` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Core Specification Steward | Small-Core boundary, coherence, compatibility and contraction stewardship | `GAEP-RA-004` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Core Subject Owner | one bounded Core semantic subject and compatibility obligations | unassigned by subject; candidate operating label, registry mapping unresolved |
| Semantic Decision Authority | accountable selection or interpretation of an exact semantic question in assigned scope | `GAEP-RA-005` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Profile Specification Steward | one Profile's semantic applicability rules, obligations, evidence contract, conformance and evolution | unassigned by profile; selection authority remains separate |
| GAEP Conformance Authority | declared conformance evaluation and result | unassigned; candidate operating label, registry mapping unresolved |
| GAEP Identity and Authority Steward | role taxonomy, assignments, delegation and accountable-human chains | `GAEP-RA-007` proposed for `mehdi-panahi`; not effective pending explicit acceptance |
| GAEP Assurance Authority | critical claims, evidence rules, assurance evaluation and gate method | unassigned |
| GAEP Audit Authority | scoped audit coverage, integrity, reconstruction, correction and independent challenge | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Audit Authority` |
| GAEP Risk Owner | risk-register integrity, assessment method, treatment tracking and review | unassigned |
| GAEP Security Authority | threat model, security controls and security Risk Acceptance within assigned scope | unassigned |
| GAEP Data, Privacy, and Records Authority | data purpose, privacy, classification, retention, deletion, legal hold and records | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Data and Privacy Authority` |
| GAEP AI System Authority | use case, autonomy, evaluation, provider, human oversight and drift | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `AI System Authority` |
| GAEP Operational Authority | support, incidents, continuity, recovery, cost and retirement | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Operational Authority` |
| GAEP Incident and Continuity Authority | material incident declaration, evidence custody, coordinated response, communication, continuity, recovery, closure and reopening | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Incident and Continuity Authority` |
| GAEP Legal, IP, and Supplier Authority | ownership, distribution, licensing, contracts, supplier and jurisdiction obligations | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Legal and Supplier Authority` |
| GAEP Organizational Trust Authority | workforce trust, accessibility, affected-person protection, ethics and appeal boundaries | unassigned; candidate operating label, registry mapping unresolved; not silently equivalent to `Organizational Trust Authority` |
| GAEP Adoption Owner | workflow substitution, training, support, trust and expansion | unassigned |
| GAEP Workspace Steward | repositories, external mappings, freshness, validation and portability | unassigned |
| GAEP Metric Integrity Owner | metric definitions, data quality, anti-gaming, privacy and independent reporting | unassigned; candidate operating label, registry mapping unresolved |
| GAEP Initiative Owner | local Initiative outcome, applicability and affected-participant obligations | unassigned; candidate operating label, registry mapping unresolved |
| GAEP Pilot Facilitator | executes a manual pilot without hiding facilitation cost | unassigned; candidate operating label, registry mapping unresolved |
| Candidate Baseline Proposer | assembles and submits an exact Candidate Revision Set through a Baseline Proposal | `GAEP-RA-008` proposed for `mehdi-panahi`; not effective pending explicit acceptance; no approval or designation authority |
| Candidate Baseline Approver | evaluates and may issue a version-bound Approval Determination for an exact Baseline Proposal | unassigned |
| GAEP Independent Reviewer | tests assumptions, harms, alternatives and evidence within declared competence | unassigned |

## Proposed minimum authority package — pending acceptance

The records below implement the selected minimum model without making it effective. Each Role Assignment has authoring lifecycle `proposed`; explicit acceptance is pending, its effective time is unset, and it is not effective. The package must not be backdated: if the named Principal explicitly accepts an exact revision, the acceptance event and effective time are recorded contemporaneously in a later revision.

### Principal, organization and authority source

| Field | Proposed record |
|---|---|
| Human Principal ID | `mehdi-panahi` |
| Display name | Mehdi Panahi |
| Principal type | Human Principal |
| Identity basis and limitation | Human selection supplied for this candidate closure work; no repository account, filesystem owner, Git author, or chat identity is substituted for the Principal record, and no external identity-assurance claim is made. |
| Accountable Organization Scope ID | `urn:gaep:candidate:organization:governing-owner` |
| Accountable Organization Scope display name | GAEP Foundational Specification Initiative; despite the display name, this record treats it as an Organization Scope, not as an Engineering Initiative identity. |
| Authority source ID | `GAEP-AUTH-SRC-001` |
| Authority source | Explicit founder/owner authority over the GAEP Foundational Specification Initiative. |
| Authority-source record class | Proposed authority-source declaration that may support a later standing Authority Grant under GAEP-CORE-001 for the bounded decision-role eligibility listed below; it is not itself an Authority Grant, Approval Determination, or executable permission. |
| Assigning Principal and role | `mehdi-panahi`, acting as the declared founder/owner authority source; self-assignment and role concentration are disclosed limitations. |
| Selection provenance | `GAEP-DEC-007` in `docs/next/06_GAEP_On_GAEP/003_DECISION_REGISTER.md` at accepted Batch 1 checkpoint `0719efb75b09c8704d08385d6cd61541fd9c614c`, file SHA-256 `0bda79df57d9fc9fbb3b1053c68220f81bb1fe38f773a2e9690cb0d39ed2bae8`, records the supplied Principal, intended assignment set, authority source, scope, no-delegation rule, limitations, and review trigger. |
| Provenance limitation | The source records the human selection but not an independently assured identity assertion or exact selection timestamp. Acceptance evidence, acceptance time, effective time, exact accepted assignment revision, and any standing Authority Grant remain absent and must not be invented. |
| Assignment scope | Only the `feature/rethink` candidate documentation and its candidate closure work in the GAEP repository. |
| Explicit exclusions | Entire-company authority, unrelated projects, legacy-corpus supersession, Profile activation, Candidate Revision Set or Baseline Set designation, baseline approval, participant activity, executable prototype, external-system effect, procurement, release, deployment, production, and implementation authorization. |
| Authority-source status | Authoring lifecycle `proposed`; acceptance pending; effective time unset; not current. It becomes a current declared source no earlier than explicit acceptance of its exact record revision with the assignment package; any standing Authority Grant needed for decision eligibility remains a separate record. |

### Proposed Role Assignment records

Every row incorporates the common conditions below. The Role ID is the canonical controlled value in `GAEP-REG-008`; no stewardship role is silently aliased to a decision role.

| Assignment ID | Canonical Role ID and exact value | Bounded responsibility | Explicit authority boundary | Current validity |
|---|---|---|---|---|
| `GAEP-RA-001` | `gaep.role.initiative-sponsor` — GAEP Initiative Sponsor | sponsor, prioritize, resource, narrow, pause, or stop Engineering Initiative `urn:gaep:candidate:initiative:vnext-preimplementation` | no company mandate, baseline approval, constitutional supersession, Profile activation, implementation, or external effect | acceptance pending; effective time unset; not effective |
| `GAEP-RA-002` | `gaep.role.product-owner` — GAEP Product Owner | product problem, provisional identity boundary, non-goals, value, priority, and outcome decisions for the local Product identity candidate `urn:gaep:candidate:product:gaep` within the candidate closure scope | the provisional ID is not yet a canonical Product Scope Reference; no independent evidence acceptance, Profile activation, constitutional amendment, baseline approval, or implementation permission | acceptance pending; effective time unset; not effective |
| `GAEP-RA-003` | `gaep.role.specification-steward` — GAEP Specification Steward | candidate-corpus coherence, requirement identity, dependency integrity, migration coordination, and proposed release assembly | stewardship does not select semantic outcomes, approve a baseline, or authorize an effect | acceptance pending; effective time unset; not effective |
| `GAEP-RA-004` | `gaep.role.core-specification-steward` — GAEP Core Specification Steward | Core boundary, coherence, compatibility, and reduction stewardship | stewardship does not confer Semantic Decision Authority, Profile authority, approval, or executable permission | acceptance pending; effective time unset; not effective |
| `GAEP-RA-005` | `gaep.role.semantic-decision-authority` — Semantic Decision Authority | accountable selection and interpretation of exact candidate semantic questions recorded in a Decision Record, including `GAEP-DEC-007` and its Product/Initiative ontology within this closure scope | no implicit constitutional amendment, migration approval, Profile activation, baseline approval, or authority beyond the exact Decision question and revision | acceptance pending; effective time unset; not effective |
| `GAEP-RA-006` | `gaep.role.constitutional-owner` — GAEP Constitutional Owner | prepare and interpret candidate constitutional-change proposals within this package's documentation-only closure scope | this package explicitly excludes legacy-corpus supersession and cannot support a constitutional Approval Determination; considering or approving an exact legacy supersession subject requires a new or revised Role Assignment and standing Authority Grant that expressly include it, plus the required reviews, Approval Case, effective time, migration, and rollback records | acceptance pending; effective time unset; not effective |
| `GAEP-RA-007` | `gaep.role.identity-authority-steward` — GAEP Identity and Authority Steward | maintain candidate Principal, role, assignment, delegation, and authority-chain semantics and records | cannot silently validate, expand, accept, or rewrite the holder's own authority; every material authority action remains separately attributable and reviewable | acceptance pending; effective time unset; not effective |
| `GAEP-RA-008` | `gaep.role.candidate-baseline-proposer` — Candidate Baseline Proposer | assemble an exact Candidate Revision Set and submit a version-bound Baseline Proposal when prerequisites are met | may not evaluate or approve its own proposal, designate a Baseline Set, supersede legacy content, or authorize implementation | acceptance pending; effective time unset; not effective |

### Common assignment conditions

| Condition | Binding for every `GAEP-RA-001` through `GAEP-RA-008` record |
|---|---|
| Assignment revision | Must resolve to the exact immutable revision or content digest of this assignment record that the Principal accepts; the current mutable Proposed document is not sufficient for decision or gate reliance. |
| Provenance and evidence | Every assignment inherits the exact `GAEP-DEC-007` checkpoint binding and provenance limitation above. Before acceptance, the record must add the exact acceptance evidence, attributable source, timestamp, accepted revision or digest, and identity basis; package inheritance does not waive any per-assignment field. |
| Effective time and acceptance | Unset. Effectiveness begins no earlier than the contemporaneously recorded explicit acceptance of the exact assignment revision by `mehdi-panahi`, after this record exists. Drafting, repository merge, elapsed time, or prior conduct cannot backdate it. Acceptance can make a Role Assignment current, but it does not create the separate standing Authority Grant required for decision eligibility. |
| Standing decision authority | None. Any role classified for decision authority remains ineligible to exercise that class until a separate current standing Authority Grant identifies Principal, decision class, exact scope, time, constraints, and authority source. |
| Approval authority | None is effective. `GAEP-RA-006` names a role type classified for bounded constitutional approval, but this package's assignment scope excludes legacy-corpus supersession and cannot support a constitutional Approval Determination. Any such action requires a new or revised exact Role Assignment and current standing Authority Grant expressly covering the supersession subject, plus an exact Approval Case, subject revision, policy, review, and constitutional procedure. Candidate Baseline Approver remains unassigned. |
| Expiry and review | No automatic expiry was supplied. Mandatory review occurs on the earliest of Candidate Revision Set creation, Baseline Proposal creation, change in project ownership, 90 days after the recorded effective time, material change to the assignment scope or authority source, or revocation. |
| Delegation | Prohibited. No delegation or further delegation is permitted unless a separate, explicit, narrower governed record is later authorized. |
| Conflicts and independence | The same Principal is proposed as sponsor, Product Owner, two specification stewards, Semantic Decision Authority, Constitutional Owner, Identity and Authority Steward, and baseline proposer. Every material action must name the exact acting role. This concentration cannot satisfy independent review, assurance, or baseline-approval independence. |
| Backup and succession | Unassigned/not supplied. Loss of availability or authority therefore produces an explicit unresolved condition until a governed successor accepts a new assignment. |
| Revocation and invalidation | Explicit withdrawal, authority-source invalidation, scope change, ownership change, or a conflicting later assignment makes the affected assignment ineligible and triggers re-evaluation before another material action. |
| Executable authority | None. A Role Assignment or standing authority source is not an executable Authorization Grant; participant, external-system, prototype, production, and implementation effects remain unauthorized. |

### Acting-role and segregation rule

Holding several assignments never permits an ambiguous `approved_by: Mehdi` record. Every material action must identify `principal: mehdi-panahi`, one exact `acting_role_id`, the exact action and subject revision, applicable assignment and authority-source IDs, scope, time, and resulting Decision, Review, Approval, or other record type. If more than one role is exercised, each role and the reason for combining them must be explicit.

The following roles remain intentionally unassigned and cannot be inferred from any proposed assignment above:

| Canonical Role ID | Exact value | Independence boundary |
|---|---|---|
| `gaep.role.candidate-baseline-approver` | Candidate Baseline Approver | No Candidate Baseline Approval Case or Approval Determination may identify an approver until a separate assignment discloses role combination, conflict, evidence, independence limits, and review conditions. |
| `gaep.role.independent-reviewer` | GAEP Independent Reviewer | No independent semantic or assurance conclusion exists until a named competent human receives and accepts a separate assignment. |
| `gaep.role.assurance-steward` | GAEP Assurance Authority | No attributable assurance evaluation exists until a named competent human accepts a separate assignment and it becomes effective. Claim acceptance, critical-claim-rule decisions, or gate results additionally require a current scoped standing Authority Grant for the applicable decision class. |

## Existing profile-role label crosswalk

Profile metadata now names `GAEP Profile Specification Steward` for semantic stewardship. The applicability contracts separately use domain-role labels for selection, approval, assessment, or operational decisions. The mappings below expose proposed GAEP-specific operating aliases for those domain roles. They remain recommendations under `GAEP-DEC-018`, not silent renames, Principal assignments, or authority grants.

| Existing profile label | Proposed GAEP operating label or composition | Current disposition |
|---|---|---|
| Product Governance Authority | GAEP Product Owner plus scoped local governance authority | mapping unresolved |
| Engineering Change Authority | GAEP Initiative Owner plus scoped engineering authority | mapping unresolved |
| Migration Authority | GAEP Initiative Owner plus scoped migration authority | mapping unresolved |
| Security Authority | GAEP Security Authority | mapping unresolved |
| Operational Authority | GAEP Operational Authority | mapping unresolved |
| Experiment Authority | GAEP Product Research Owner plus scoped experiment authority | mapping unresolved |
| Capability Steward | GAEP Profile Specification Steward consultation; a separate selection authority is required | mapping unresolved |
| Architecture Authority | GAEP Initiative Owner plus scoped architecture authority | mapping unresolved |
| Assurance Authority | GAEP Assurance Authority | mapping unresolved |
| Data and Privacy Authority | GAEP Data, Privacy, and Records Authority | mapping unresolved |
| AI System Authority | GAEP AI System Authority | mapping unresolved |
| Legal and Supplier Authority | GAEP Legal, IP, and Supplier Authority | mapping unresolved |
| Organizational Trust Authority | GAEP Organizational Trust Authority | mapping unresolved |
| Audit Authority | GAEP Audit Authority | mapping unresolved |
| Incident and Continuity Authority | GAEP Incident and Continuity Authority | mapping unresolved |

## Candidate user system

- sponsor: CTO, VP Engineering or Head of Platform hypothesis;
- adoption owner: platform or architecture lead hypothesis;
- primary operator: technical lead or architect preparing a material change hypothesis;
- participant: engineer using AI assistance hypothesis;
- reviewer: product, architecture, security, quality or operations according to risk;
- steward: repository/platform maintainer;
- beneficiaries: delivery teams, operators, affected users and later assessors.

These are hypotheses, not validated personas or assignments.

## Role naming rule

Role type, accountable identity, authority source, assignment scope, valid time, delegation and acting role are separate. A candidate role label is canonical only when its exact value resolves through one `GAEP-REG-008` ID. `Semantic Decision Authority`, `Candidate Baseline Proposer`, and `Candidate Baseline Approver` are exact registered values despite not using the `GAEP` display prefix; they are not aliases for a steward, owner, approver, or reviewer role. GAEP operating labels explicitly marked `registry mapping unresolved` above remain noncanonical proposals and confer nothing. A consumer organization may bind its own role labels only through an approved mapping. Near-synonyms are not silently equivalent; the candidate role registry must map or retire them before baseline approval.

## Separation of governance layers

Governance **of GAEP** decides product scope, Core meaning, profile releases, security, operations and distribution. Governance **through GAEP** applies approved semantics to consumer initiatives. The same person may hold multiple roles, but the acting role, authority source and conflict of interest remain explicit.

## Immediate blocker

The proposed package remains not effective: acceptance evidence is absent and every effective time is unset. Even after valid acceptance makes an assignment current, decision-class eligibility remains blocked until the required separate standing Authority Grant exists. Candidate Baseline Approver, GAEP Independent Reviewer, GAEP Assurance Authority, and other applicable domain authorities remain unassigned. No candidate baseline, Profile activation, constitutional supersession, implementation-readiness result, or implementation authorization follows from this document.
