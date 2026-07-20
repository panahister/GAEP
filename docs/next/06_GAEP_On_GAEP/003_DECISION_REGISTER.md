---
id: GAEP-SELF-003
title: GAEP-on-GAEP Decision Register
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Decision and Authorization Steward
scope: GAEP Next pre-implementation restructuring initiative
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-006
informative_references:
  - 011_PRODUCT_DECISION_CROSSWALK.md
supersedes: []
---

# GAEP-on-GAEP Decision Register

No entry in this register is an Approval Determination or Authorization Grant. `Current recommendation` is a Recommendation, not a Decision Outcome, Approval Determination, or Authorization Grant. Every record has authoring lifecycle `draft`. `GAEP-DEC-007` records an explicit human selection with Decision Outcome `option-selected`, while its decision effectiveness remains `pending`; every other Decision Outcome remains `unresolved`. `GAEP-SELF-009` now contains canonical proposed Role Assignment records for the selected closure-work roles, but none is accepted or effective and no current scoped standing Authority Grant exists. Mentioning a Principal, assignment, or intended acting role here does not establish decision eligibility.

| Decision ID | Decision question | Current recommendation or options | Proposed owner/authority | Evidence, criteria, and review trigger |
|---|---|---|---|---|
| GAEP-DEC-001 | What is the first-horizon product form? | Recommend vendor-neutral governance specification and conformance model, with profiles, repository-visible workspaces, and optional realizations/adapters | GAEP Product Owner and GAEP Investment Sponsor, unassigned | problem interviews, alternatives assessment, value/burden evidence; review before Product Charter approval |
| GAEP-DEC-002 | What is the first governed workflow? | Recommend governed change preparation with distinct Review, Decision, Approval, Authorization, effect, and baseline records | GAEP Product Owner, unassigned | workflow comparison, independent usability and manual Product/non-Product pilots |
| GAEP-DEC-003 | How should the candidate migrate the legacy Draft corpus? | Recommend non-destructive `docs/next/`; retain legacy Drafts until exact supersession approval | GAEP Specification Steward, unassigned; baseline approving authority also unassigned | candidate validation, migration map, independent review, recovery; review at Candidate Baseline Gate |
| GAEP-DEC-004 | What is the pre-implementation effect boundary? | Prepare, but do not activate, an `E0` through `E5` effect-class proposal; current work remains read-only analysis or explicitly authorized documentation/evidence preparation, with no executable reference realization, participant, external-system, or production activity | GAEP Decision and Authorization Steward and GAEP Investment Sponsor, unassigned | effect-class scenarios, readiness and authorization process; review if requested scope changes |
| GAEP-DEC-005 | What semantic architecture should GAEP use? | Recommend small Core plus Profiles, Realizations, Adapters, and Workspaces | GAEP Specification Steward with GAEP Core Subject Owners, unassigned | scenario coverage, dependency DAG, duplication/complexity review |
| GAEP-DEC-006 | Where should authority live? | Recommend repository-visible, not repository-exclusive, with authority declared per representation | GAEP Workspace Steward, unassigned | external-authority and no-double-entry pilots |
| GAEP-DEC-007 | How should durable subjects and bounded work relate, including the legacy Product-as-Initiative conflict? | Option B selected: Product is a long-lived Managed Asset and Initiative is bounded governed work affecting one or more Managed Assets; separately select versioned mapping with staged dual-read and no initial dual-write; prepare version-bound constitutional supersession without claiming approval | Mehdi Panahi is the selecting Human Principal; `GAEP-RA-004`, `GAEP-RA-005`, and `GAEP-RA-006` are proposed but not accepted or effective, and no current scoped standing Authority Grant establishes decision eligibility | exact legacy/candidate bindings, identity and lifecycle migration, cardinality, state allocation, compatibility by dimension, rollback, historical interpretation, independent review, and constitutional approval; reopen on material semantic or authority change |
| GAEP-DEC-008 | What is a baseline? | Recommend named, scoped Baseline Set of exact revisions, not intrinsic artifact lifecycle state | GAEP Core Subject Owner, unassigned | multi-release, rollback and federation scenarios |
| GAEP-DEC-009 | How dependent may authoritative GAEP state be on AI? | Recommend Core and workspace remain usable through no-AI/manual path | GAEP AI System Authority and GAEP Workspace Steward, unassigned | provider-replacement and manual continuity scenarios |
| GAEP-DEC-010 | What distribution and license model applies? | Options remain internal, public specification, open, source-available, commercial or hybrid | GAEP Distribution and Ecosystem Owner plus GAEP Legal, IP, and Supplier Authority, unassigned | owner intent, IP inventory, market/ecosystem and supplier analysis |
| GAEP-DEC-011 | What is the initial target segment and anti-segment? | Unresolved; Product Charter contains only a segment hypothesis | GAEP Product Research Owner and GAEP Product Owner, unassigned | interviews, historical cases and sponsor choice |
| GAEP-DEC-012 | Who sponsors, funds and operates GAEP? | Unresolved | GAEP Investment Sponsor and GAEP Operational Authority, unassigned | organizational authority, capacity, support and funding evidence |
| GAEP-DEC-013 | What classification and handling model applies? | `internal` is a working label, not approved classification | GAEP Data, Privacy, and Records Authority plus GAEP Security Authority, unassigned | data inventory, policy, jurisdiction and repository-access review |
| GAEP-DEC-014 | How should external standards influence GAEP? | Recommend versioned mappings/profiles, not unexamined Core import | GAEP Specification Steward, unassigned | detailed crosswalk, rights and compatibility review |
| GAEP-DEC-015 | What AI autonomy is appropriate for the first slice? | Recommend AI-1 or AI-2 for evaluation; AI-3/AI-4 not selected | GAEP AI System Authority, unassigned | use-case record, benefit/risk evidence, provider and evaluation results |
| GAEP-DEC-016 | Which future capabilities remain deferred? | Recommend candidate deferral register; each item remains unresolved until approved | GAEP Product Owner and GAEP Investment Sponsor, unassigned | trace to first job, alternatives, prerequisites and displaced-work analysis |
| GAEP-DEC-017 | What is the canonical metric catalog and threshold set? | Recommend Product Strategy own definitions and GAEP-on-GAEP instantiate them | GAEP Product Owner and GAEP Metric Integrity Owner, unassigned | baseline data, privacy, anti-gaming and decision-use review |
| GAEP-DEC-018 | What is the canonical owner-role taxonomy and assignment model? | Recommend controlled role types with explicit scoped assignments and no silent aliases | GAEP Identity and Authority Steward, unassigned | role registry, organizational composition and separation review |
| GAEP-DEC-019 | How are gate evaluation, approval and activity authorization separated? | Recommend distinct Pilot, Baseline and Implementation gates followed by Approval Cases and scoped Authorization Grants | GAEP Decision and Authorization Steward, unassigned | Core conformance and paper scenarios |

## GAEP-DEC-004 proposed effect classes

The following classification is a proposal for later decision and policy work. It is not activated by this register and does not itself permit any activity. Progression between classes is never automatic; every activity remains subject to its exact applicable Decision, Approval, and Authorization requirements.

| Class | Proposed boundary | Current workstream treatment |
|---|---|---|
| `E0` | Read-only analysis with no repository or external effect. | Permitted within the declared analysis scope. |
| `E1` | Documentation-only, reviewable, reversible change with no runtime or external effect. | Permitted only within the user's explicitly confirmed pre-implementation documentation, governance, evidence, and validator/tooling closure batches; evidence preparation remains non-authoritative. |
| `E2` | Local, non-authoritative reference realization with no participant, external-system, or production effect. | Proposed only; not authorized. |
| `E3` | Participant-facing pilot or research activity. | Proposed only; not authorized. Participant recruitment and data collection are prohibited in the current workstream. |
| `E4` | External-system integration or another effect outside the local documentation subject. | Proposed only; not authorized. |
| `E5` | Production-capable execution, deployment, release, or operational effect. | Proposed only; not authorized. |

Paper scenarios, a reversible non-authoritative migration rehearsal, and a GAEP-on-GAEP manual rehearsal may be prepared as documentation evidence. They do not activate `E2`, constitute a participant pilot, prove operational behavior, or authorize execution. `GAEP-DEC-004` remains `unresolved` until the proposed class definitions, boundaries, authority rules, and transition conditions receive their own valid Decision Outcome.

## GAEP-DEC-007 selected semantic direction

This section records the explicit human selection supplied for candidate closure while preserving the distinction between selection, decision effectiveness, constitutional approval, migration approval, baseline designation, Profile activation, and executable authorization.

### Decision state and authority boundary

| Field | Recorded value | Boundary |
|---|---|---|
| Decision Question | How should durable subjects and bounded work relate, including the legacy Product-as-Initiative conflict? | Material change to the question creates a new Decision Record revision. |
| Human Principal | `mehdi-panahi` — Mehdi Panahi | Repository authorship, filesystem ownership, and chat identity do not substitute for a canonical Principal and Role Assignment record. |
| Accountable Organization Scope | `GAEP Foundational Specification Initiative` | This is recorded only as the supplied Organization Scope display name. It is not an Engineering Initiative identity; canonical Organization Scope identity and Authority Namespace binding remain unresolved. |
| Selected option | Option B — Product as a long-lived Managed Asset targeted by bounded Initiatives | This is the semantic Decision Outcome only. |
| Decision Outcome | `option-selected` | It is not an Approval Determination or Authorization Grant. |
| Decision effectiveness | `pending` | Canonical proposed Role Assignment records exist, but acceptance evidence and effective times are absent; the applicable decision role also lacks a current scoped standing Authority Grant. |
| Declared authority source | Explicit founder/owner authority over the GAEP Foundational Specification Initiative | `GAEP-AUTH-SRC-001` is only a proposed authority-source declaration; it is not a standing Authority Grant and still requires exact acceptance and authority-chain validation. |
| Assignment scope | The `feature/rethink` candidate documentation and its candidate closure work | It does not extend to a company, unrelated project, participant activity, external system, or production environment. |
| Intended assignment set | Mehdi Panahi as GAEP Initiative Sponsor, GAEP Product Owner, GAEP Specification Steward, GAEP Core Specification Steward, Semantic Decision Authority, GAEP Constitutional Owner, GAEP Identity and Authority Steward, and Candidate Baseline Proposer | These exact role values are registered and proposed through `GAEP-RA-001` through `GAEP-RA-008`; none is accepted or effective. GAEP Core Specification Steward does not itself confer decision authority, and no standing Authority Grant is established by the assignment package. |
| Explicitly unassigned roles | Candidate Baseline Approver, Independent Reviewer, and GAEP Assurance Authority | None of these roles or their authority may be inferred from the selecting Principal's other intended assignments. |
| Delegation | None unless separately and explicitly recorded | No delegation is inferred. |
| Independence limitation | The selecting Principal is also proposed for several stewardship roles; Independent Reviewer, Candidate Baseline Approver, and GAEP Assurance Authority remain unassigned | Absence of independent challenge is a remaining limitation, not implicit agreement. |
| Backup and succession | Not supplied | Required backup or succession treatment remains pending where applicable and must not be invented. |
| Effective time | Not set | It must not be backdated; it follows creation and explicit acceptance of the applicable assignment record. |
| Review trigger | Earliest of Candidate Revision Set creation, Baseline Proposal creation, project-ownership change, 90 days after an assignment becomes effective, or material semantic change | Review does not itself approve or authorize an effect. |

### Selected conceptual model

| Concept | Selected meaning |
|---|---|
| Managed Asset | A durable governed subject that may continue across multiple bounded efforts. Candidate Managed Asset types include Product, Platform, System, Service, Data Asset, and Reusable Capability. |
| Product | A long-lived Managed Asset with identity and lifecycle independent of any one Initiative. |
| Initiative | A bounded governed effort that creates, changes, migrates, secures, operates, or retires one or more Managed Assets. |
| Change | A proposed or authorized delta against explicit baselines. |
| Work Item | A planned or executable unit of a Change. |

The selected model preserves separate identities and lifetimes for durable governed subjects and temporary governed work. One Product may be targeted by several Initiatives, one Initiative may target several Managed Assets, Initiative closure does not retire a Product, and Product retirement does not erase Initiative history.

### Conflicting definitions

| Source | Current meaning | Authority and migration condition |
|---|---|---|
| Legacy `docs/01_Foundation/001_GAEP_CONSTITUTION.md` | Product is an Engineering Initiative type. | Exact current Draft source content is identified by legacy Git snapshot `29312cf841c9c462431cfc64ea38a49eb3e9a0e5`, file SHA-256 `a2e56b654ba4740d25670628201b0efd1c2f7fc08009a63c5b57e970b03225e0`, and Article I clause SHA-256 `8e21642e796671e5ef7f6596cec0378e93765ee77f904a6e3793393c05fdee4a`; constitutional supersession is not approved. |
| Legacy State, Dynamic Engineering, and Product Lifecycle documents | Product lifecycle and applicability attach to an Initiative classified as Product. | Current Draft input; one legacy Product-Initiative may combine durable subject and bounded work identity. |
| Legacy navigation, principle, glossary, and terminology documents | `docs/000_READ_FIRST.md`, Foundation principles 004/006, and References 991/992 repeat Product as one Engineering Initiative type and use that distinction for generic-term guidance. | Current Draft inputs; navigation, principle, glossary, alias, and deprecation consequences require exact reconciliation, not only lifecycle-document edits. |
| Legacy workspace, metadata, naming, package, and migration documents | Product workspaces, IDs, metadata fields, package activation, and upgrade guidance are defined as Product-specific specializations of Initiative structures. | Current Draft inputs; schema, path, identifier, package, query, adapter, and consumer behavior require explicit mapping under the selected ontology. |
| Candidate `GAEP-CORE-001` | Product is a Managed Asset type with identity independent of Initiatives; bounded Initiatives target one or more Managed Assets. | Proposed normative assumption under `GAEP-SCOPE-REQ-004`; not approved or baselined. |
| Candidate `GAEP-PROF-001` and semantic registries | Product Profile applies when an Initiative creates or materially evolves a Product Managed Asset; `targets` links work to durable subject. | Proposed specialization and registry meaning; must be reconciled to the selected outcome without activating the Profile. |

### Alternatives

| Option | Definition | Principal benefits | Principal costs and risks | Current disposition |
|---|---|---|---|---|
| A — retain legacy | Product remains an Engineering Initiative type. | Maximum continuity with current Draft terminology and records. | Product identity ends or blurs with bounded work; repeated evolution and multi-asset work require additional semantics; candidate Core and Profile text must be revised. | considered; not selected for this Decision revision |
| B — select candidate model | Product is a durable Managed Asset; bounded Initiatives and Changes target it. | Separates enduring identity from work, supports many Initiatives per Product and multi-asset Initiatives, and preserves Product history after work closes. | Breaking identity, lifecycle, schema, relationship, Profile, query, and migration change for legacy Product-Initiative records. | selected; effectiveness pending |
| C — explicit dual semantic model | Permit Product to be modeled as an Initiative type or as a Managed Asset under an explicit, versioned discriminator; neither representation is silently equivalent to the other. | Can preserve both legitimate meanings where different contexts require them. | Doubles identity, conformance, query, Profile, authority, and lifecycle complexity; requires conflict and cross-model relationship rules. | considered; not selected for this Decision revision |
| D — no action | Leave both corpora unchanged and select no semantic reconciliation. | Avoids unsupported changes while making non-adoption explicit. | Blocks candidate baseline approval, cross-corpus conformance, migration, and authoritative Product identity resolution. | considered; not selected for this Decision revision |
| E — defer | Postpone selection through an approved Decision Record with an owner, current assumed answer, trigger, expiry, and review scope. | Allows bounded evidence collection without disguising uncertainty as resolution. | The affected candidate baseline scope remains blocked or must be explicitly excluded; the current normative assumption still requires reconciliation. | considered; not selected for this Decision revision |

### Compatibility and migration treatment

Semantic selection and migration treatment are separate. Selecting an ontology does not by itself approve a cutover, mapping, coexistence interval, or legacy retirement.

| Treatment | Compatible semantic outcomes | Current disposition and boundary |
|---|---|---|
| Breaking cutover | Usually Option B | not selected; no cutover is authorized |
| Versioned mapping and staged dual-read | Option B, or transition from Option C | selected representation strategy; exact revisions, canonical read side by consumer version, mapping direction, loss, ambiguity, single-write authority, deprecation, rollback, and exit criteria remain to be evidenced |
| Persistent dual representation | Option C | not selected; no permanent second source of truth is created |
| No authoritative migration | Options A, D, or E | not selected as the intended end state; authoritative migration nevertheless remains unauthorized until its separate prerequisites exist |

During the initial compatibility phase, legacy records retain their historical semantics and remain available to legacy consumers. Candidate consumers may use only an explicitly versioned mapping or derived view, and the candidate representation becomes canonical only for explicitly versioned new consumers after the required approval. Mapping fidelity is recorded separately from compatibility, representation strategy, migration status, approval, and authorization. No silent identity equivalence is introduced.

Dual-write is prohibited during the initial compatibility phase. No mapping may write back from a candidate projection to a legacy source, and no future process may update both representations without a separately selected conflict model, synchronization protocol, write authority, recovery behavior, Decision Outcome, Approval Determination where required, and exact Authorization Grant.

### Constitutional intent

The selected intent is version-bound supersession, not immediate constitutional amendment or approval. The legacy constitutional corpus remains unchanged and recoverable. A later constitutional package must identify the exact legacy clause and revision or digest, exact candidate replacement revision, effective scope and time, migration mapping, compatibility and historical-interpretation consequences, rollback and recovery, approving Constitutional Owner, and version-bound Approval Determination. `GAEP-CST-REQ-076` through `GAEP-CST-REQ-079` remain applicable. Adding `superseded` metadata, editing this register, or selecting Option B is insufficient.

### Decision criteria and required evidence

The accountable decision must evaluate:

- lifecycle correctness when Products outlive releases, migrations, and corrective work;
- cardinality for one Product targeted by many Initiatives and one Initiative targeting several Managed Assets;
- canonical identity, historical trace, baseline, state, Profile selection, and authority consequences;
- migration feasibility for legacy Product-Initiative records without mechanical rename or silent identity reuse;
- compatibility for consumers, queries, schemas, relationships, examples, and external references;
- author, reviewer, operator, and migration burden, including the simpler-model alternative;
- reversibility, rollback, coexistence interval, deprecation, and recovery;
- Product and non-Product scenario evidence, dissent, and counter-evidence.

Required evidence includes exact legacy and candidate Resource Revisions or qualified content digests, the clause-level mapping in `GAEP-RM-004`, cardinality and lifecycle scenarios, affected-requirement, Profile, registry, schema, and workspace-record inventory, consumer-impact analysis, and an independent semantic review. The legacy constitutional source and starting candidate Git revision are identified, but the post-Batch 1 candidate replacement revisions, independent review, compatibility results, mapping rehearsal, and dissent record remain incomplete.

### Required decision and approval record

Decision Outcome is `option-selected`; decision effectiveness remains `pending`. Before candidate baseline approval, the record still requires effective Role Assignments, exact post-change subject revisions, complete evidence and assumptions, review of dissent and adverse evidence, compatibility results by dimension, migration obligations, validity and review conditions, and independent semantic review. Any outcome that amends or supersedes the legacy constitutional Product meaning requires a separate GAEP Constitutional Owner decision and version-bound constitutional Approval Determination; the candidate-baseline Approval Determination remains separate. The human selection, repository text, validation success, or permission to prepare and edit this proposal is not an Approval Determination or Authorization Grant.

Material changes to Product or Initiative identity, cardinality, lifecycle, state ownership, Profile applicability, compatibility, migration evidence, authority source, or assignment scope reopen this decision. Until the selected outcome becomes effective and is reconciled through exact version-bound evidence and any required constitutional approval, `GAEP-GAP-050` blocks candidate baseline approval.

Except for the alternatives and selected treatment documented for `GAEP-DEC-007`, every record above still lacks a complete alternatives analysis. `GAEP-DEC-007` has a selected Outcome but remains a Proposed, pending-effectiveness record with proposed-but-ineffective assignments, no standing Authority Grant, incomplete target-revision evidence, no independent evaluation, incomplete dissent review, incomplete compatibility assessment, and no constitutional Approval Determination.

## Decisions required before candidate baseline approval

Decisions 001 through 006 and 008 through 019 still require explicit disposition or an approved reason they do not apply. `GAEP-DEC-007` requires effectiveness and closure of its listed evidence, authority, compatibility, and constitutional conditions. A Decision Outcome, any required Approval Determination, and any Authorization Grant remain separate records.

`GAEP-SELF-011` maps every Product Strategy open-decision ID to these roll-up records; the mapping does not resolve any source decision.
