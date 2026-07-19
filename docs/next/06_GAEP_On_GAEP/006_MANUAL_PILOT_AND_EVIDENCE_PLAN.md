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
