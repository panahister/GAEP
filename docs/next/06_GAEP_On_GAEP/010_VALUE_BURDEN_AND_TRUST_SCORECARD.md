---
id: GAEP-SELF-010
title: GAEP Value, Burden, and Trust Scorecard
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP manual pilot and implementation-readiness evidence
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - ../00_GAEP_Product_Strategy/006_OUTCOMES_ECONOMICS_AND_BURDEN.md
supersedes: []
---

# GAEP Value, Burden, and Trust Scorecard

This scorecard is a GAEP-on-GAEP candidate instance of the outcome, economics, burden, and metric-contract rules in `GAEP-STR-006`. It does not create a second product metric authority. Targets remain unset until baseline observation and accountable approval.

| Metric ID | Dimension | Candidate measure | Countermetric or caution | Owner |
|---|---|---|---|---|
| GAEP-SELF-MET-001 | user value | elapsed and active time to decision-ready trusted context | more time may reflect higher-risk work | GAEP Product Owner |
| GAEP-SELF-MET-002 | user value | repeated explanation or duplicate artifact work avoided | self-reported avoidance can be overstated | GAEP Product Owner |
| GAEP-SELF-MET-003 | quality | downstream impacts found before approval | finding count can reward over-reporting | GAEP Assurance Authority |
| GAEP-SELF-MET-004 | quality | post-approval rework and defect escape | attribution to GAEP may be uncertain | GAEP Assurance Authority |
| GAEP-SELF-MET-005 | governance | approval latency segmented by risk and outcome | fast approval may be superficial | GAEP Decision and Authorization Steward |
| GAEP-SELF-MET-006 | governance | useful reviewer findings and condition closure | finding quantity is not effectiveness | GAEP Assurance Authority |
| GAEP-SELF-MET-007 | burden | author active minutes and mandatory fields | novelty and facilitator effects | GAEP Product Owner |
| GAEP-SELF-MET-008 | burden | reviewer/approver active minutes and queue delay | high-risk work requires more effort | GAEP Decision and Authorization Steward |
| GAEP-SELF-MET-009 | burden | steward maintenance and reconciliation hours | hidden integration effort must be included | GAEP Workspace Steward |
| GAEP-SELF-MET-010 | adoption | time to first value and repeat voluntary use | mandated use is not willingness | GAEP Adoption Owner |
| GAEP-SELF-MET-011 | trust | corrections, challenges, overrides and perceived autonomy | low challenge may signal fear, not trust | GAEP Organizational Trust Authority |
| GAEP-SELF-MET-012 | trust | perceived surveillance or role ambiguity | anonymous collection and privacy needed | GAEP Organizational Trust Authority |
| GAEP-SELF-MET-013 | economics | total cost per governed Change | avoided incident estimates can be speculative | GAEP Investment Sponsor |
| GAEP-SELF-MET-014 | economics | saved effort and avoided rework | must subtract facilitation, tooling and support | GAEP Investment Sponsor |
| GAEP-SELF-MET-015 | portability | successful manual/provider-replacement continuation | test must include authoritative history | GAEP Workspace Steward |
| GAEP-SELF-MET-016 | security/AI | unsafe near misses, injection escapes, unauthorized effect attempts | reporting culture affects counts | GAEP Security Authority |

## Metric contract

Before collection, each selected metric receives formula, unit, inclusion/exclusion, population, segmentation, baseline window, target, data source, quality limits, privacy classification, access, retention, owner, cadence, countermetric and decision use. Metrics cannot be repurposed silently.

Every owner listed above is a candidate role type and is currently unassigned. No collection or threshold is authorized by this scorecard.

## Decision use

The readiness decision considers the scorecard as a balanced system. Improvements in trace completeness do not compensate automatically for excessive burden, loss of trust, poor product value or critical security failure.
