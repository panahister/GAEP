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

## Execution record

For each run, record selected Core/profile versions, organizational bindings, scenario inputs, actors, assumptions, decisions, observed ambiguities, invented workarounds, burden, result, evidence and required specification changes. A scenario result expires when a materially relevant contract changes.

