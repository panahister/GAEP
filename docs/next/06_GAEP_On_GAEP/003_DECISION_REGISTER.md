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

No entry in this register is approved. `Current recommendation` is a Recommendation, not a Decision Outcome, Approval Determination, or Authorization Grant. Every record currently has authoring lifecycle `draft` and Decision Outcome `unresolved` unless a later version contains the complete Core decision contract. Every proposed owner role is unassigned; mentioning a role does not identify an accountable authority.

| Decision ID | Decision question | Current recommendation or options | Proposed owner/authority | Evidence, criteria, and review trigger |
|---|---|---|---|---|
| GAEP-DEC-001 | What is the first-horizon product form? | Recommend vendor-neutral governance specification and conformance model, with profiles, repository-visible workspaces, and optional realizations/adapters | GAEP Product Owner and GAEP Investment Sponsor, unassigned | problem interviews, alternatives assessment, value/burden evidence; review before Product Charter approval |
| GAEP-DEC-002 | What is the first governed workflow? | Recommend governed change preparation with distinct Review, Decision, Approval, Authorization, effect, and baseline records | GAEP Product Owner, unassigned | workflow comparison, independent usability and manual Product/non-Product pilots |
| GAEP-DEC-003 | How should the candidate migrate the legacy Draft corpus? | Recommend non-destructive `docs/next/`; retain legacy Drafts until exact supersession approval | GAEP Specification Steward, unassigned; baseline approving authority also unassigned | candidate validation, migration map, independent review, recovery; review at Candidate Baseline Gate |
| GAEP-DEC-004 | What is the pre-implementation effect boundary? | Recommend documentation/research only; no product/runtime implementation without later gate, approval, and activity-specific grant | GAEP Decision and Authorization Steward and GAEP Investment Sponsor, unassigned | readiness and authorization process; review if requested scope changes |
| GAEP-DEC-005 | What semantic architecture should GAEP use? | Recommend small Core plus Profiles, Realizations, Adapters, and Workspaces | GAEP Specification Steward with GAEP Core Subject Owners, unassigned | scenario coverage, dependency DAG, duplication/complexity review |
| GAEP-DEC-006 | Where should authority live? | Recommend repository-visible, not repository-exclusive, with authority declared per representation | GAEP Workspace Steward, unassigned | external-authority and no-double-entry pilots |
| GAEP-DEC-007 | How should durable subjects and bounded work relate, including the legacy Product-as-Initiative conflict? | Recommend Product as a durable Managed Asset targeted by bounded Engineering Initiatives; legacy retention, a dual semantic model, no-action, and deferral remain unselected alternatives | GAEP Core Specification Steward, unassigned; semantic decision, constitutional, and baseline authorities also unassigned | legacy/candidate definition comparison, identity and lifecycle migration, cardinality, concurrent-change, retirement, compatibility, rollback, and historical-interpretation scenarios |
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

## GAEP-DEC-007 candidate decision package

This section exposes a breaking semantic choice that the summary row cannot safely compress. It is a candidate decision package, not a Decision Outcome. The current candidate normative text assumes Option B, but no accountable Human Principal has selected or approved that option.

### Conflicting definitions

| Source | Current meaning | Authority and migration condition |
|---|---|---|
| Legacy `docs/01_Foundation/001_GAEP_CONSTITUTION.md` | Product is an Engineering Initiative type. | Current Draft input; exact revision, authority, and supersession remain unresolved. |
| Legacy State, Dynamic Engineering, and Product Lifecycle documents | Product lifecycle and applicability attach to an Initiative classified as Product. | Current Draft input; one legacy Product-Initiative may combine durable subject and bounded work identity. |
| Legacy navigation, principle, glossary, and terminology documents | `docs/000_READ_FIRST.md`, Foundation principles 004/006, and References 991/992 repeat Product as one Engineering Initiative type and use that distinction for generic-term guidance. | Current Draft inputs; navigation, principle, glossary, alias, and deprecation consequences require exact reconciliation, not only lifecycle-document edits. |
| Legacy workspace, metadata, naming, package, and migration documents | Product workspaces, IDs, metadata fields, package activation, and upgrade guidance are defined as Product-specific specializations of Initiative structures. | Current Draft inputs; schema, path, identifier, package, query, adapter, and consumer behavior require explicit mapping under the selected ontology. |
| Candidate `GAEP-CORE-001` | Product is a Managed Asset type with identity independent of Initiatives; bounded Initiatives target one or more Managed Assets. | Proposed normative assumption under `GAEP-SCOPE-REQ-004`; not approved or baselined. |
| Candidate `GAEP-PROF-001` and semantic registries | Product Profile applies when an Initiative creates or materially evolves a Product Managed Asset; `targets` links work to durable subject. | Proposed specialization and registry meaning; depends on the unresolved Core decision. |

### Alternatives

| Option | Definition | Principal benefits | Principal costs and risks | Current disposition |
|---|---|---|---|---|
| A — retain legacy | Product remains an Engineering Initiative type. | Maximum continuity with current Draft terminology and records. | Product identity ends or blurs with bounded work; repeated evolution and multi-asset work require additional semantics; candidate Core and Profile text must be revised. | unselected |
| B — select candidate model | Product is a durable Managed Asset; bounded Initiatives and Changes target it. | Separates enduring identity from work, supports many Initiatives per Product and multi-asset Initiatives, and preserves Product history after work closes. | Breaking identity, lifecycle, schema, relationship, Profile, query, and migration change for legacy Product-Initiative records. | current recommendation and normative assumption; unselected |
| C — explicit dual semantic model | Permit Product to be modeled as an Initiative type or as a Managed Asset under an explicit, versioned discriminator; neither representation is silently equivalent to the other. | Can preserve both legitimate meanings where different contexts require them. | Doubles identity, conformance, query, Profile, authority, and lifecycle complexity; requires conflict and cross-model relationship rules. | unselected |
| D — no action | Leave both corpora unchanged and select no semantic reconciliation. | Avoids unsupported changes while making non-adoption explicit. | Blocks candidate baseline approval, cross-corpus conformance, migration, and authoritative Product identity resolution. | unselected |
| E — defer | Postpone selection through an approved Decision Record with an owner, current assumed answer, trigger, expiry, and review scope. | Allows bounded evidence collection without disguising uncertainty as resolution. | The affected candidate baseline scope remains blocked or must be explicitly excluded; the current normative assumption still requires reconciliation. | unselected |

### Compatibility and migration treatment

Semantic selection and migration treatment are separate. Selecting an ontology does not by itself approve a cutover, mapping, coexistence interval, or legacy retirement.

| Treatment | Compatible semantic outcomes | Required analysis before selection |
|---|---|---|
| Breaking cutover | Usually Option B | exact source/target revisions, consumer readiness, loss analysis, cutover authority, rollback, and historical access |
| Versioned mapping and staged dual-read | Option B, or transition from Option C | canonical side, mapping direction, loss/ambiguity, synchronization, write authority, conflict handling, deprecation, and exit criteria |
| Persistent dual representation | Option C | explicit discriminator, separate identity and lifecycle rules, supported Profiles, cross-model relationships, query/conformance behavior, and retirement rules |
| No authoritative migration | Options A, D, or E | retained authority, exclusions, evidence-gathering boundary, review trigger, expiry where deferred, and prohibition on implied supersession |

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

Required evidence includes exact legacy and candidate Resource Revisions or qualified content digests, the clause-level mapping in `GAEP-RM-004`, cardinality and lifecycle scenarios, affected-requirement, Profile, registry, schema, and workspace-record inventory, consumer-impact analysis, and an independent semantic review.

### Required decision and approval record

Decision Outcome remains `unresolved`. Before candidate baseline approval, the record must identify the exact selected semantic option or explicit deferral/no-action outcome, any separately selected compatibility treatment, rationale, alternatives, criteria, evidence, assumptions, dissent, risks, consequences, affected revisions, migration obligations, effective time, validity, expiry, and review triggers. It also requires an assigned GAEP Core Specification Steward for semantic ownership and a separately assigned decision authority under `GAEP-DEC-018`. Any outcome that amends or supersedes the legacy constitutional Product meaning requires a separate GAEP Constitutional Owner decision and version-bound constitutional Approval Determination; the candidate-baseline Approval Determination remains separate. Repository text, recommendation repetition, validation success, or permission to prepare or edit this proposal is not a Decision Outcome, Approval Determination, or Authorization Grant.

Material changes to Product or Initiative identity, cardinality, lifecycle, state ownership, Profile applicability, compatibility, or migration evidence reopen this decision. Until a valid outcome is recorded and reconciled, `GAEP-GAP-050` blocks candidate baseline approval.

Except for the candidate alternatives and treatments now enumerated for `GAEP-DEC-007`, every record above still lacks a complete alternatives analysis. For `GAEP-DEC-007`, the list itself remains Proposed and its exact evidence, authority, evaluation, dissent, rationale, compatibility treatment, and outcome remain incomplete. Those fields must be completed before a Decision Outcome can become `option selected`, `no action selected`, `deferred`, or `all presented options rejected`.

## Decisions required before candidate baseline approval

All Decisions 001 through 019 require explicit disposition or an approved reason they do not apply. A Decision Outcome, any required Approval Determination, and any Authorization Grant remain separate records.

`GAEP-SELF-011` maps every Product Strategy open-decision ID to these roll-up records; the mapping does not resolve any source decision.
