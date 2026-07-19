---
id: GAEP-STR-006
title: Outcomes, Economics, and Burden
document_type: product-strategy
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP outcome measurement, total cost, governance burden, and investment gates
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation product restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-001
  - GAEP-CST-003
informative_references:
  - ../../01_Foundation/002_PROJECT_VISION.md
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../03_Product_Engineering/021_PRODUCT_LIFECYCLE.md
  - ../../06_Roadmap/052_ADOPTION_GUIDE.md
supersedes: []
---

# Outcomes, Economics, and Burden

## Status and purpose

This Proposed document defines how GAEP should be evaluated before and after any implementation. It contains candidate measures and decision rules, not approved targets, a funding commitment, a pricing model, or a promise of financial return.

GAEP can fail by being unsafe, ineffective, unusable, unaffordable, unmaintainable, or trusted for the wrong reasons. A complete measurement model must include all six possibilities.

## Measurement principles

1. Measure user and organizational outcomes, not document or AI-output volume.
2. Measure the incumbent workflow before attributing change to GAEP.
3. Include author, reviewer, steward, facilitator, support, and migration labor.
4. Segment measures by workflow, risk, initiative type, participant role, and maturity where material.
5. Pair speed or automation measures with quality, risk, trust, and burden countermetrics.
6. Preserve negative, missing, and ambiguous results.
7. Do not convert product analytics into individual employee productivity ranking.
8. Treat avoided harm estimates separately from realized cash or time savings.
9. State uncertainty and attribution limits.
10. Use evidence to narrow, pivot, or stop, not only to justify expansion.

## Candidate outcome model

### Candidate primary outcome

**Hypothesis:** GAEP should reduce the total effort and uncertainty required to move a bounded consequential engineering change from intent to a trusted decision-ready state, without increasing downstream harm, governance delay, or total maintenance burden.

This is a composite outcome and is not yet a north-star metric. Research must determine whether participants can measure it reliably and whether separate outcomes are clearer.

### Outcome chain

| Level | Candidate outcome | Main confounders |
|---|---|---|
| Activity | Applicable context, impact, evidence, and authority are prepared | Facilitator expertise and case selection |
| Experience | Participants understand status, unknowns, and next action | Training and novelty |
| Decision | Review finds material issues and produces a scoped decision | Reviewer skill and available time |
| Delivery | Less rework or drift occurs after decision | Change complexity and team capability |
| Organization | Coordination cost or risk falls while AI use remains accountable | Broader process and technology changes |

## Candidate balanced scorecard

The measures below require exact definitions and approved data handling before use.

### User value and flow

| Metric ID | Candidate metric | Definition question |
|---|---|---|
| GAEP-MET-VAL-001 | Time to trusted context | From bounded intake to reviewer-agreed sufficient context; what pauses are excluded? |
| GAEP-MET-VAL-002 | Re-explanation effort | Participant time spent reconstructing previously available context across handoffs |
| GAEP-MET-VAL-003 | Time to decision-ready package | From accepted intake to first package satisfying declared entry criteria |
| GAEP-MET-VAL-004 | Decision lead time | From decision request to attributable outcome, segmented by risk |
| GAEP-MET-VAL-005 | Repeat voluntary use | Eligible workflows reused without mandate or exceptional facilitation |

### Quality and risk

| Metric ID | Candidate metric | Definition question |
|---|---|---|
| GAEP-MET-QUA-001 | Useful pre-decision findings | Material findings accepted by the change owner or authority |
| GAEP-MET-QUA-002 | Post-decision rework | Work caused by a requirement, impact, authority, or evidence gap that should reasonably have been found |
| GAEP-MET-QUA-003 | Escaped impact | Material affected subject first discovered after the declared gate |
| GAEP-MET-QUA-004 | Decision reconstruction completeness | Required decision facts independently recoverable from permitted evidence |
| GAEP-MET-QUA-005 | Control false-positive and false-negative rate | Incorrect block versus missed applicable obligation |
| GAEP-MET-QUA-006 | Stale governed state | Required records or references past their approved validity or review condition |

### Adoption and usability

| Metric ID | Candidate metric | Definition question |
|---|---|---|
| GAEP-MET-ADO-001 | Time to first independent completion | Time until a team completes the workflow without expert intervention |
| GAEP-MET-ADO-002 | Eligible-workflow completion | Completed governed workflows divided by eligible selected workflows |
| GAEP-MET-ADO-003 | Abandonment and workaround rate | Workflows abandoned or routed outside GAEP, with reason |
| GAEP-MET-ADO-004 | User comprehension | Participants correctly explain current state, authority, unknowns, and next action |
| GAEP-MET-ADO-005 | Accessibility and inclusion findings | Barriers identified and resolved across participant contexts |

### Trust and human accountability

| Metric ID | Candidate metric | Definition question |
|---|---|---|
| GAEP-MET-TRU-001 | Recommendation correction rate | Material AI or system recommendations changed after qualified review |
| GAEP-MET-TRU-002 | Approval challenge quality | Decisions changed or conditioned because challenge added evidence or exposed uncertainty |
| GAEP-MET-TRU-003 | Perceived decision clarity | Participant assessment supported by comprehension checks |
| GAEP-MET-TRU-004 | Surveillance concern and misuse incidents | Reported concern, unauthorized use, or chilling effect from evidence capture |
| GAEP-MET-TRU-005 | Contestability effectiveness | Incorrect authority, evidence, or state corrected through the defined path |

### Portability and continuity

| Metric ID | Candidate metric | Definition question |
|---|---|---|
| GAEP-MET-POR-001 | Provider-substitution continuity | Required governed meaning preserved when an execution provider changes |
| GAEP-MET-POR-002 | External-authority resolution | Required external sources resolved at the declared version and access scope |
| GAEP-MET-POR-003 | Exit recovery | Time and information loss when a realization or adapter is paused or removed |
| GAEP-MET-POR-004 | Local divergence | Unapproved semantic or profile variation detected across workspaces |

## Governance-burden model

### Burden categories

Total burden includes:

- intake and classification;
- source and authority resolution;
- artifact or record authoring;
- context maintenance and freshness review;
- reviewer and approver attention;
- policy and profile administration;
- exception and escalation handling;
- training, support, and facilitation;
- integration and reconciliation;
- conformance and migration work;
- security, privacy, records, and audit work;
- interruption, waiting, and cognitive switching;
- work duplicated in external systems;
- opportunity cost from delayed delivery.

### Burden by participant

| Participant | Burden to measure | Hidden-cost warning |
|---|---|---|
| Change owner | Preparation and remediation time | Work moved from reviewer to author may appear as review savings |
| Engineer or analyst | Context and trace maintenance | Tool time may hide cognitive interruption |
| Reviewer or approver | Review and waiting time | Faster clicks may indicate rubber stamping |
| Steward | Freshness, migration, and support | Central manual labor may subsidize pilot success |
| Specialist authority | Escalation and exception work | Scarce expertise can become a queue |
| Adoption team | Training and workflow redesign | Facilitator effort must not be excluded |
| Affected contributor | Compliance and explanation work | Unpaid or unrecorded burden can damage trust |

### Candidate burden-budget method

Before a pilot, each risk profile should define:

- target and maximum author effort;
- target and maximum reviewer attention;
- expected decision latency;
- maximum duplicate entry;
- steward maintenance expectation;
- allowed exception rate;
- escalation threshold;
- review condition when actual burden exceeds the budget.

No numeric target is approved here. Targets must be based on an observed incumbent baseline and the consequence of failure. The same budget must not be imposed on all risk tiers.

## Economic model

### Total cost of ownership

Estimate at minimum:

- product discovery and specification stewardship;
- realization, adapter, and integration acquisition or development;
- infrastructure and operations if any;
- model, tool, storage, and external service consumption;
- security, privacy, legal, procurement, and assurance review;
- migration, interoperability, and data-quality work;
- author, reviewer, approver, and steward labor;
- training, enablement, support, and change management;
- incident, recovery, compatibility, and deprecation;
- opportunity cost and organizational disruption;
- exit and replacement.

### Benefit classes

Benefits may include:

- realized time released for other work;
- avoided duplicate authoring or context reconstruction;
- reduced rework and escaped-impact cost;
- shorter decision or onboarding lead time;
- improved reuse of fit-for-purpose assets;
- reduced audit reconstruction effort;
- lower provider-change or migration cost;
- reduced probability or impact of consequential failure.

Avoided-risk estimates must state probability range, impact range, evidence, and uncertainty. They must not be added to realized savings as if equally certain.

### Investment decision frame

At each gate, compare:

1. continue the incumbent workflow;
2. improve the incumbent workflow without GAEP;
3. compose existing products or practices;
4. perform GAEP manually;
5. authorize a bounded realization;
6. narrow, defer, or stop.

The cheapest implementation is not necessarily the lowest total cost, and the most complete specification is not necessarily the highest value.

## Countermetrics and anti-gaming

| Optimized metric | Required countermetric |
|---|---|
| Faster approval | Useful findings, reversals, and escaped impacts |
| More automation | Incorrect actions, human corrections, and recovery cost |
| More trace links | Link usefulness, freshness, and maintenance burden |
| More complete metadata | Time spent, comprehension, and duplicate entry |
| Higher workflow completion | Abandonment, workaround, and inapplicable-work rate |
| More reuse | Local exception, incompatibility, and downstream rework |
| Lower reviewer time | Reviewer comprehension and decision quality |
| Higher AI acceptance | Correction quality and unchallenged error |

No measure should reward concealment of uncertainty, refusal to classify applicable work, or avoidance of documented risk.

## Normative measurement and economic rules

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STR-MET-REQ-001 | Every approved success metric SHALL define purpose, formula, population, unit, data source, owner, baseline, target or decision threshold, cadence, limitations, and countermetric. | Metric-dictionary review |
| GAEP-STR-MET-REQ-002 | A product-value decision SHALL include user value, quality or risk, adoption, trust, burden, portability, and total cost as applicable. | Gate scorecard review |
| GAEP-STR-MET-REQ-003 | Pilot economics SHALL include facilitator, steward, reviewer, migration, support, and duplicate-entry labor. | Cost-record audit |
| GAEP-STR-MET-REQ-004 | GAEP SHALL NOT use document count, trace count, AI-output volume, approval count, or automation rate as a standalone success measure. | Scorecard review |
| GAEP-STR-MET-REQ-005 | Metrics collected for product learning SHALL NOT be used to rank individual employee productivity without a separate lawful, transparent, and approved purpose. | Data-use review |
| GAEP-STR-MET-REQ-006 | Before-and-after claims SHALL disclose case-selection, novelty, facilitation, learning, and concurrent-change limitations. | Evaluation-method review |
| GAEP-STR-MET-REQ-007 | A risk-reduction benefit SHALL state probability, impact, evidence, and uncertainty and SHALL be reported separately from realized savings. | Economic-model review |
| GAEP-STR-MET-REQ-008 | Every selected profile SHALL define a governance-burden budget or a time-bounded plan to establish one. | Profile review |
| GAEP-STR-MET-REQ-009 | A phase gate SHALL identify proceed, proceed-with-conditions, narrow, pivot, pause, and stop criteria. | Gate-definition review |
| GAEP-STR-MET-REQ-010 | Negative and inconclusive results SHALL be retained with the same provenance requirements as favorable results. | Evidence audit |

## Candidate gate scorecard

Before implementation authorization, the accountable authority must receive a package showing:

- incumbent baseline;
- target workflow and participant cohort;
- outcome and burden thresholds;
- results from manual execution;
- useful and failed cases;
- total observed and projected cost;
- privacy and trust findings;
- alternative comparison;
- evidence limitations;
- explicit proceed, narrow, pivot, or stop recommendation.

## Open decisions

| Decision ID | Open decision |
|---|---|
| GAEP-STR-MET-DEC-001 | What is the primary outcome or smallest balanced set for the first workflow? |
| GAEP-STR-MET-DEC-002 | What baseline period and case-selection method are feasible? |
| GAEP-STR-MET-DEC-003 | What burden budgets apply to the selected risk profiles? |
| GAEP-STR-MET-DEC-004 | What targets authorize a bounded implementation? |
| GAEP-STR-MET-DEC-005 | Who owns metric integrity and independent evaluation? |
| GAEP-STR-MET-DEC-006 | What data may be collected, at what granularity, and for how long? |
| GAEP-STR-MET-DEC-007 | How is GAEP funded, and how are shared versus local costs allocated? |
| GAEP-STR-MET-DEC-008 | Which benefit classes may be monetized for the first investment decision? |

Until these decisions are approved, the repository has outcome candidates but no authorized claim of economic value.
