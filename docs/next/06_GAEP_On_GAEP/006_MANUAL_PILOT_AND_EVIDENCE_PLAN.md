---
id: GAEP-SELF-006
title: GAEP-on-GAEP Manual Pilot and Evidence Plan
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: Pre-implementation manual validation
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-007
  - GAEP-PROF-006
  - GAEP-PROF-011
  - GAEP-PROF-015
  - GAEP-RM-005
informative_references:
  - 001_INITIATIVE_PROFILE.md
  - 005_ASSURANCE_CASE.md
supersedes: []
---

# GAEP-on-GAEP Manual Pilot and Evidence Plan

## Objectives

The pilot tests problem value, comprehension, semantic completeness, reviewer effectiveness, governance burden, portability, and willingness to repeat before implementation choices distort the result.

## Candidate cohorts

- one team handling a meaningful Product change;
- one team handling a bounded non-Product change such as migration, security remediation, infrastructure change, or operational correction;
- authors, engineers, reviewers, approvers, workspace stewards, and sponsors represented separately where practical;
- at least one participant not involved in authoring GAEP.

Selection must document maturity, current tools, AI use, risk, incentives and likely selection bias.

## Baseline capture

Before introducing the candidate workflow, capture:

- existing sources and handoffs;
- time spent locating and re-explaining context;
- decision and approval process;
- rework, missed impacts and review findings;
- author, reviewer and steward effort;
- current trust, autonomy and surveillance concerns;
- existing workflow cost and recurring pain.

## Manual workflow

1. Record change intent, managed assets, baseline and boundaries.
2. Resolve authorities and assemble a bounded context snapshot.
3. Identify impacts, risks, assumptions, unknowns and applicable profiles.
4. Draft or update the governed resource and decision.
5. Present the exact delta, evidence, uncertainty and obligations.
6. Perform review and record findings and their disposition.
7. Record a Decision Outcome and, when applicable, a separate Approval Determination.
8. Acquire a scoped Authorization Grant when the planned baseline transition or other persistent effect requires one.
9. Perform the authorized transition and record the exact resulting revision, Baseline Set membership, actual effect, and obligations.
10. Capture elapsed time, active effort, defects, confusion, duplicate entry and facilitator intervention.

## Mandatory challenge scenarios

- stale or missing context;
- conflicting authorities;
- inaccessible external source;
- approval delay, reassignment and revocation;
- profile conflict;
- concurrent change against the same baseline;
- emergency rollback;
- AI provider unavailable or prohibited;
- generated claim contradicted by stronger evidence;
- participant attempts to bypass the workflow because of burden.

## Measures

Measures span user value, engineering quality, governance, adoption, burden, trust, economics and portability. Every selected metric receives definition, owner, source, baseline, target, cadence, segmentation, countermetric and privacy classification before data collection.

## Bias controls

- record facilitator effort as product cost;
- separate self-dogfooding from independent evidence;
- retain negative results and abandoned paths;
- compare with the current workflow and credible alternatives;
- do not treat positive opinions as repeat willingness;
- do not change success thresholds after results without a recorded decision;
- prohibit individual performance ranking from pilot telemetry.

## Candidate exit outcomes

- proceed to candidate baseline approval;
- narrow the workflow or target segment;
- revise the Core or profiles and repeat;
- compose existing tools instead of building a runtime;
- pause for missing ownership or trust controls;
- stop investment because value does not justify burden.

## GAEP-on-GAEP rehearsal GAEP-SELF-REH-001

This 2026-07-20 activity is a manual documentation rehearsal, not the participant pilot described above. It used the candidate-closure work itself as the case and stopped before any approval, baseline designation, participant activity, implementation, migration, or external effect. The normalized plan SHA-256 is `c7b0346d57069535c1a5e0e85f19804574fa22459bf6c474587a9414a7347dd5`, omitting this result section; the broader normalized 47-file semantic input aggregate is `1bae309eb7e937dc8f82acfbd26d4c9d4046f5ed2ec4ac661f7643f710b9adea`.

| Manual workflow step | Rehearsal observation | Result |
|---|---|---|
| 1. Intent, assets, baseline, boundaries | The bounded intent is candidate specification closure; target assets are the proposed corpus and its registries; checkpoint `8289d11b2e2764dfedeb2b2e4a4a2817244a97e4` is storage evidence, not a baseline; runtime and platform implementation remain excluded. | paper-pass |
| 2. Authorities and context | Proposed assignments, owner-role types, repository state, prior checkpoint evidence, and exact semantic inputs are visible; no assignment is accepted or effective and no standing GAEP Authority Grant exists. | expected-stop finding |
| 3. Impacts, risks, assumptions, unknowns, Profiles | Core contraction, 135 former-requirement dispositions, 70 tiered Open Decisions, Product/Initiative compatibility, two extracted Profiles, and unresolved applicability are explicit. | paper-pass-with-blockers |
| 4. Governed resource and decision drafting | Candidate documents and registries were revised with stable IDs and migration trace; criticality labels were not misrepresented as Decision Outcomes. | paper-pass |
| 5. Exact delta, evidence, uncertainty, obligations | Numeric contraction, structural validation, scenario limitations, absent authority, and unresolved decisions are disclosed; exact formal Candidate Revision Set mechanics remain a separate task. | paper-pass-with-blockers |
| 6. Review and findings | Static self-review and deterministic validation can run; independent human semantic, legal, security, data, accessibility, and assurance review is absent. | partial; independent-review blocker retained |
| 7. Decision Outcome and Approval Determination | Product Option B remains selected but ineffective; no Core Open Decision is decided or deferred; no Approval Determination was created. | correctly not executed |
| 8. Authorization Grant | No GAEP Authorization Grant exists. The user's repository instruction permits this documentation task but is not converted into a GAEP governed grant. | correctly not executed |
| 9. Authorized transition and Baseline Set | No baseline transition, supersession, migration, or persistent platform effect was attempted. | correctly not executed |
| 10. Measures and burden | Qualitative burden is high: 70 open semantic decisions, 19 Profile rows, many authority roles, and cross-layer trace are difficult to review manually. No participant, elapsed-time baseline, active-effort instrumentation, or privacy-governed metric collection occurred. | evidence gap retained |

Challenge injection also produced the expected safe outcomes: stale counts required recount; absent authority stopped decision effectiveness; changed semantics invalidated old checkpoint claims; a dual-write proposal was denied; unsupported identity/cardinality remained unresolved; and passing structural validation did not advance approval or implementation state.

Overall result: `rehearsal-partial; gate-blocked`. The candidate process can expose missing authority, semantic uncertainty, state separation, and prohibited effects without inventing completion. It has not demonstrated user value, comprehension by a new participant, independent reviewer effectiveness, acceptable burden, portability outside this repository, willingness to repeat, or operational enforcement. Those claims remain `not-assessed`, and participant pilot work remains separately gated.
