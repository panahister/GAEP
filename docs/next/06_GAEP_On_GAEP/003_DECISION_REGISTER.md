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
| GAEP-DEC-007 | How should durable subjects and bounded work relate? | Recommend Managed Assets as durable; Engineering Initiatives bounded; Changes target exact baselines | GAEP Core Subject Owner, unassigned | cardinality, concurrent-change and retirement scenarios |
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

For every record above, the alternatives, including no action, dissent, consequences, risks, exact evidence revisions, effective time, expiry and review triggers remain incomplete. Those fields must be completed before a Decision Outcome can become `option selected`, `no action selected`, `deferred`, or `all presented options rejected`.

## Decisions required before candidate baseline approval

All Decisions 001 through 019 require explicit disposition or an approved reason they do not apply. A Decision Outcome, any required Approval Determination, and any Authorization Grant remain separate records.

`GAEP-SELF-011` maps every Product Strategy open-decision ID to these roll-up records; the mapping does not resolve any source decision.
