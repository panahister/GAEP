---
id: GAEP-GUIDE-001
title: Reference Scenario Catalog
document_type: scenario-catalog
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Assurance Authority
scope: Paper conformance and pre-implementation validation
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
informative_references: []
supersedes: []
---

# Reference Scenario Catalog

## Pass rule

A scenario passes only when the selected Core and Profiles can represent its subjects, versions, authority, state, policy, decisions, evidence, effects, recovery, and unresolved conditions without inventing ad hoc meanings or requiring irrelevant ceremony.

A pass is scoped scenario evidence only. It is not a Decision Outcome, independent assurance, an Approval Determination, an Authority Grant, an Authorization Grant, a Candidate Revision Set or Baseline Set designation, Profile activation, migration, supersession, implementation authorization, or operational proof. A scenario that requires any of those meanings to be inferred from authorship, repository access, file presence, a relationship, or a positive result fails.

## Scenario set

| Scenario | What it tests | Candidate pass criteria |
|---|---|---|
| S01 Typo-only documentation correction | lightweight path and proportionality | no architecture theater; authority and revision remain clear; review is minimal |
| S02 Brownfield defect in one service | existing constraints and localized impact | affected asset/change/work distinction is clear; reused evidence remains valid only where applicable |
| S03 Public API contract change | multiple consumers and concurrent baselines | impact spans assets/repositories; approvals bind exact contract; dependent changes remain traceable |
| S04 Regulated identity service change | high-risk architecture, security, privacy and assurance | stronger profiles compose deterministically; accountable authorities and evidence are sufficient |
| S05 Emergency production rollback | break-glass, effects, compensation and retrospective obligations | urgent authorization is scoped and expiring; actual effects and follow-up obligations cannot disappear |
| S06 Disposable architecture spike | experiment boundary and non-promotion | outputs remain non-authoritative until explicit promotion and validation |
| S07 Stale or inaccessible external design | external authority and degraded context | unavailable revision is explicit; dependent decisions are blocked, qualified or re-evaluated by policy |
| S08 Concurrent changes against one baseline | baseline sets, conflicts and merge semantics | neither change silently overwrites the other; combined impact is evaluated |
| S09 Organization and initiative profile conflict | profile precedence and non-weakening | effective configuration and conflict reason are deterministic and reviewable |
| S10 Approval revoked during paused run | identity, validity and mid-run authorization | resumed effects are denied until valid re-authorization; completed effects remain recorded |
| S11 AI provider replacement | portability, drift and adapter evidence | authoritative workspace remains usable; provider-specific evidence is invalidated or re-evaluated explicitly |
| S12 Shared capability update with unknown consumers | federation, supply chain and blast radius | unknown consumers are represented as uncertainty; release/approval reflects incomplete impact knowledge |
| S13 External system round-trip loss | mapping fidelity and no-double-entry | loss is exposed; semantic equivalence is not falsely claimed; reconciliation has an owner |
| S14 Deletion under legal hold | records, privacy and conflicting obligations | deletion and retention authorities are distinct; result records permitted and prohibited actions |
| S15 AI reviewer agrees with AI author | correlated assurance risk | independence is assessed; agreement alone is not stronger evidence |
| S16 Small organization with combined roles | role composition and separation of duties | combined roles are explicit; minimum independent review is applied only where risk requires it |
| S17 Repository history rewritten or record corrected | audit integrity and legitimate correction | tampering and controlled correction are distinguishable; superseded evidence remains traceable |
| S18 Participant rejects monitoring | workforce trust and appeal | permitted telemetry purpose is clear; unnecessary collection stops; challenge and escalation are available |

## Product ontology and compatibility scenarios

These scenarios exercise the selected candidate semantic model and proposed compatibility treatment. They do not make that model constitutionally effective, modify legacy authority, authorize migration, activate the Product Development Profile, or prove operational behavior.

| Scenario | What it tests | Candidate pass criteria | Primary trace targets |
|---|---|---|---|
| S19 One Product targeted by several Initiatives | durable Product identity across concurrent or successive bounded work | one canonical Product Managed Asset remains distinct from every Initiative; each Initiative has its own identity, governing scope, lifecycle and explicit `targets` relationship; no approval or authority propagates among Initiatives | `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-004`, `GAEP-SCOPE-REQ-009`, `GAEP-SCOPE-REQ-021`, `gaep.rel.targets`, `GAEP-REL-REQ-001`, `GAEP-REL-REQ-002` |
| S20 One Initiative targeting several Managed Assets | multi-asset cardinality and accountable scope | every target Managed Asset is explicit and independently identifiable; affected scopes, participating organizations and authority boundaries remain visible; the Initiative does not become any target asset | `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-012`, `GAEP-SCOPE-REQ-020`, `GAEP-SCOPE-REQ-021`, `gaep.rel.targets`, `GAEP-REL-REQ-001` |
| S21 Product continues after an Initiative closes | independent subject lifetime and state ownership | the Initiative reaches its applicable closed condition while the Product identity and Product operational-eligibility state remain unchanged; history retains the target relationship | `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-017`, `GAEP-STATE-REG-REQ-001`, `gaep.state.operational-eligibility` |
| S22 Initiative closure is attempted as Product retirement | negative state propagation and subject separation | the attempted propagated retirement is rejected; Initiative and Product State Records remain bound to their exact subjects and no relationship manufactures a Product transition | `GAEP-SCOPE-REQ-017`, `GAEP-STATE-REQ-002`, `GAEP-STATE-REQ-019`, `GAEP-STATE-REG-REQ-001`, `GAEP-REL-REQ-002` |
| S23 Product retirement with preserved Initiative history | retirement, retention and historical trace | Product operational eligibility may become `retired`, but Initiative, Change, Work Item, decision, evidence and relationship history remains reconstructable under its own retention and revision dispositions | `GAEP-SCOPE-REQ-018`, `GAEP-SCOPE-REQ-022`, `GAEP-SCOPE-REQ-024`, `GAEP-STATE-REQ-019`, `GAEP-TPS-REQ-024` |
| S24 Legacy Product-Initiative maps to one Product and one Initiative | explicit one-to-one semantic split | the exact legacy revision remains historically interpretable; separate Product and Initiative identities are attributable to one mapping method; `targets` and provenance links are explicit; every mapped Change uses `governed-by-initiative`, every mapped Work Item uses `contributes-to-change`, and the Work Item's Initiative is derived through its Change; no identity equivalence or supersession is inferred | `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-004`, `GAEP-SCOPE-REQ-024`, `GAEP-ECF-REQ-016`, `GAEP-ECF-REQ-017`, `GAEP-TPS-REQ-002`, `GAEP-TPS-REQ-005`, `GAEP-TPS-REQ-009`, `gaep.rel.governed-by-initiative`, `gaep.rel.contributes-to-change`, `gaep.rel.targets`, `gaep.rel.derived-from` |
| S25 Legacy Product-Initiative maps to one Product and several Initiatives | one-to-many split and evidence-backed cardinality | each candidate Initiative has distinct evidence and exact scope and targets the same Product; an unsupported split remains unresolved rather than being invented from dates, folders or labels | `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-014`, `GAEP-SCOPE-REQ-015`, `GAEP-ECF-REQ-013`, `GAEP-ECF-REQ-016`, `GAEP-REL-REQ-001`, `gaep.rel.targets`, `gaep.rel.derived-from` |
| S26 Mapping with information loss | mapping fidelity, omissions and compatibility separation | mapping fidelity is `lossy`; omitted identity, state, relationship, authority, evidence and consumer consequences are explicit; no positive compatibility aggregate hides the loss | `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-013`, `GAEP-ECF-REQ-016`, `GAEP-ECF-REQ-017`, `GAEP-TPS-REQ-010`, `GAEP-STATE-REG-REQ-005`, `gaep.state.mapping-fidelity` |
| S27 Unresolved mapping | ambiguity preservation and fail-explicit behavior | the result remains unresolved with candidate identities, competing interpretations, missing evidence and a resolution path; it does not default to the nearest name, folder, one-to-one mapping or broadest scope | `GAEP-SCOPE-REQ-014`, `GAEP-SCOPE-REQ-015`, `GAEP-ECF-REQ-013`, `GAEP-TPS-REQ-017`, `GAEP-STATE-REG-REQ-003`, `GAEP-STATE-REG-REQ-005` |
| S28 Legacy-only consumer | retained historical semantics during staged coexistence | the consumer receives the exact legacy representation and meaning it supports; candidate semantics are not injected, legacy authority is not changed, and unsupported candidate fields remain explicit | `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-012`, `GAEP-ECF-REQ-015`, `GAEP-ECF-REQ-016`, `GAEP-TPS-REQ-014` |
| S29 Candidate-only consumer | explicit candidate representation without silent legacy identity reuse | the consumer receives separate exact Product and Initiative identities and registered relationships; source and mapping versions are visible; the legacy combined identifier is not reused as both canonical identities | `GAEP-SCOPE-REQ-019`, `GAEP-SCOPE-REQ-024`, `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-012`, `GAEP-ECF-REQ-016`, `gaep.rel.targets` |
| S30 Staged dual-read | versioned coexistence and source-authority clarity | legacy and candidate projections are read against exact versions; canonical authority is declared per representation and semantic scope; disagreement, staleness and loss remain visible; neither side is written through the other | `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-012`, `GAEP-ECF-REQ-014`, `GAEP-ECF-REQ-015`, `GAEP-ECF-REQ-016`, `GAEP-TPS-REQ-014` |
| S31 Attempted dual-write | initial-phase write prohibition and authority separation | the proposed write is denied; a simulated result may exist only as non-authoritative rehearsal evidence and does not mutate either representation; no relationship, mapping, Decision Outcome, repository access or successful read is treated as permission | `GAEP-DEC-007`, `GAEP-RM-004`, `GAEP-REL-REQ-002` |
| S32 Compatibility rollback | reversible mapping and recovery without history erasure | prior read routing and mapping disposition can be restored; attempted outputs, decisions, evidence, loss and residual consequences remain attributable; rollback does not claim that historical facts never occurred | `GAEP-STATE-REQ-020`, `GAEP-ECF-REQ-015`, `GAEP-ECF-REQ-016`, `GAEP-TPS-REQ-024` |
| S33 Historical reconstruction | time-bound interpretation across legacy and candidate representations | an assessor can reconstruct the exact legacy source meaning, mapping revision, candidate identities, state ownership, consumer view and authority boundary applicable at the selected time | `GAEP-SCOPE-REQ-018`, `GAEP-SCOPE-REQ-022`, `GAEP-ECF-REQ-016`, `GAEP-PCR-REQ-025`, `GAEP-TPS-REQ-009`, `GAEP-TPS-REQ-024` |
| S34 Ambiguous identity | collision, alias and silent identity-reuse prevention | similarly named subjects or one legacy combined identifier produce explicit candidate identities or an unresolved result; path, display name and source identifier alone cannot decide identity | `GAEP-SCOPE-REQ-001`, `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-014`, `GAEP-SCOPE-REQ-015`, `GAEP-SCOPE-REQ-019`, `GAEP-SCOPE-REQ-024`, `GAEP-ECF-REQ-013`, `GAEP-TPS-REQ-017` |
| S35 Ambiguous cardinality | uncertainty over how many Products or Initiatives a legacy record represents | every supported cardinality is tied to evidence; unknown one-to-one, one-to-many or many-to-many structure remains explicit and blocks authoritative transformation | `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-014`, `GAEP-SCOPE-REQ-015`, `GAEP-REL-REQ-001`, `GAEP-ECF-REQ-013`, `GAEP-ECF-REQ-016` |
| S36 Product Profile applicability before and after mapping | applicability re-evaluation without implicit selection or activation | legacy classification does not automatically select the Product Development Profile; the mapped Product and Initiative are re-evaluated against exact Profile versions and an attributable manifest preserves before/after applicability, conflicts, unknowns and invalidation | `GAEP-SCOPE-REQ-023`, `GAEP-SCOPE-REQ-024`, `GAEP-PROD-REQ-009`, `GAEP-PROD-REQ-012`, `GAEP-PCR-REQ-002`, `GAEP-PCR-REQ-007`, `GAEP-PCR-REQ-020`, `GAEP-PCR-REQ-021`, `GAEP-PCR-REQ-025`, `GAEP-PCR-REQ-029`, `gaep.state.applicability` |

## Execution record

For each run, record:

- scenario ID and exact scenario-catalog revision;
- activity type and actual effect boundary;
- selected Core, Profile, registry, legacy-source and candidate-target revisions or qualified digests;
- organizational bindings, scenario inputs and excluded scope;
- acting Principals, exact acting roles, assignment or assumed-authority status, authority source and independence limitations;
- Decision Outcomes, Approval Determinations, Authority Grants and Authorization Grants as separate references, using `not-applicable`, `absent`, or `unresolved` explicitly where appropriate;
- exact Product, Initiative, Change, Work Item, mapping and consumer identities used;
- State Records by exact subject and State Dimension;
- compatibility result by assessed dimension, mapping fidelity, representation strategy and migration disposition as separate fields;
- assumptions, unresolved ambiguity, information loss, invented workarounds, burden and negative results;
- rollback and historical-reconstruction observations;
- evidence, result limitations, required specification changes and invalidation triggers.

Paper scenarios and reversible or GAEP-on-GAEP manual rehearsals pass this catalog only when their outputs are labeled non-authoritative and non-operational. They preserve legacy authority, make no external or production effect, use no participant data, and claim no supersession, migration completion, Profile activation, baseline readiness, implementation readiness, approval, or authorization. A scenario result expires when a materially relevant contract, input revision, mapping, authority assumption, or compatibility condition changes.
