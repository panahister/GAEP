---
id: GAEP-REG-010
title: Core Boundary and Complexity Budget
document_type: registry
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Core Specification Steward
scope: Release-blocking boundary, size budget, and extraction register for GAEP Core
normative_level: normative
classification: internal
provenance: GAEP pre-implementation structural repair
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-008
  - GAEP-REG-009
  - GAEP-CORE-001
  - GAEP-CORE-002
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-008
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Core Boundary and Complexity Budget

## Release-blocking purpose

GAEP Core is the smallest portable semantic kernel required by materially different profiles and realizations. It is not the union of all useful governance, AI, provider, workflow-engine, runtime-reliability, marketplace, or federation behavior. This document makes that boundary an approval gate rather than an editorial preference.

The current candidate is **blocked from baseline approval**: it contains 12 Core contracts and 353 normative requirement rows, exceeding the candidate budgets below. The counts are a 2026-07-19 repository snapshot and must be recomputed from the exact Candidate Revision Set reviewed by the gate.

## Candidate complexity budget

| Budget ID | Measure | Candidate maximum | Current candidate | Gate result |
|---|---|---:|---:|---|
| `GAEP-CORE-BUDGET-001` | Core normative contracts | 8 | 12 | exceeded; baseline blocked |
| `GAEP-CORE-BUDGET-002` | Core normative requirement rows | 160 | 353 | exceeded; baseline blocked |
| `GAEP-CORE-BUDGET-003` | Normative requirements in one Core contract | 24 | 38 maximum observed | exceeded; baseline blocked |
| `GAEP-CORE-BUDGET-004` | Canonical Core entity/concept types | 48 | unresolved; inventory not yet closed | unresolved; baseline blocked |
| `GAEP-CORE-BUDGET-005` | Unresolved Core Open Decisions that affect baseline meaning | 0 unless explicitly approved as non-blocking deferrals | 70 registered; blocker classification incomplete | unresolved; baseline blocked |

Budgets are candidate governance decisions, not claims that every smaller design is sufficient. A reduction must preserve constitutional invariants, semantic separations, negative cases, traceability, and conformance evidence.

## Core admission test

A concept or normative requirement belongs in Core only when all conditions hold:

1. removing it would break a constitutional invariant or make the common semantic model internally uninterpretable;
2. necessity is demonstrated by at least two materially different profile families and at least one non-AI realization scenario;
3. it cannot be expressed as a profile obligation, realization rule, adapter contract, registry entry, scenario, or informative guidance without weakening the invariant;
4. it is independent of a named provider, tool, marketplace, workflow engine, storage mechanism, protocol, or organizational topology;
5. its owner, exact semantics, states, relationships, negative cases, and conformance evidence are defined;
6. adding it remains within all budgets or an approved, expiring Complexity Exception explicitly pays the cost and identifies consolidation or removal.

## Extraction register

`extraction-required` means the current text remains visible for review but cannot enter an approved Core baseline at that location. Extraction preserves the invariant through a smaller Core interface while moving mechanics to a profile, realization, adapter, scenario catalog, or deferred capability.

| Extraction ID | Current Core surface | Mechanic / concern | Target owner | Required retained Core invariant | Disposition | Accountable role / assignment |
|---|---|---|---|---|---|---|
| `GAEP-EXT-001` | GAEP-IDAUTH-REQ-016, GAEP-IDAUTH-REQ-017 | AI self-escalation and AI self-approval mechanics | AI Safety and Assurance Profile | non-human capability cannot manufacture authority or accountable human approval | extraction-required | AI System Authority / unassigned |
| `GAEP-EXT-002` | GAEP-RESVER-REQ-016 | AI-specific provenance fields | AI Provenance Profile | every material revision preserves attributable producing Principal, context, and capability provenance | extraction-required | GAEP Assurance Authority / unassigned |
| `GAEP-EXT-003` | GAEP-CWC-REQ-006, GAEP-CWC-REQ-007, GAEP-CWC-REQ-008, GAEP-CWC-REQ-009, GAEP-CWC-REQ-010 | workflow-plan structure, step scheduling, parallelism, and plan expansion mechanics | Workflow Realization Contract | executable work binds exact subject, state, scope, authority, and change invalidation | extraction-required | GAEP Runtime Steward / unassigned |
| `GAEP-EXT-004` | GAEP-CWC-REQ-013, GAEP-CWC-REQ-014, GAEP-CWC-REQ-015, GAEP-CWC-REQ-016, GAEP-CWC-REQ-017, GAEP-CWC-REQ-018, GAEP-CWC-REQ-019 | prompt/instruction privilege, context poisoning, token budgeting, summarization, and mosaic risk | AI Context Security Profile | untrusted input cannot gain authority and governed inputs cannot be silently omitted or reclassified | extraction-required | GAEP Security Authority / unassigned |
| `GAEP-EXT-005` | GAEP-CWC-REQ-020, GAEP-CWC-REQ-021, GAEP-CWC-REQ-026 | provider routing, external transmission, secret references, and hidden provider memory | Provider Adapter and Data Handling Profiles | external recipients and data effects require explicit scope, policy, handling, and authorization | extraction-required | Data and Privacy Authority / unassigned |
| `GAEP-EXT-006` | GAEP-CWC-REQ-022, GAEP-CWC-REQ-023, GAEP-CWC-REQ-024, GAEP-CWC-REQ-025 | context-pack gap, sufficiency, refresh, and reconstruction mechanics | Context Assembly Realization | missing governed inputs remain explicit and material decisions remain reconstructable | extraction-required | GAEP Runtime Steward / unassigned |
| `GAEP-EXT-007` | GAEP-EER-REQ-014, GAEP-EER-REQ-015, GAEP-EER-REQ-016, GAEP-EER-REQ-017, GAEP-EER-REQ-022 | retry, idempotency, concurrency, aggregate budget, and retry-exhaustion mechanics | Runtime Reliability Profile | duplicate or uncertain material effects cannot be reported or repeated as safe without evidence | extraction-required | Operational Authority / unassigned |
| `GAEP-EXT-008` | GAEP-EER-REQ-018, GAEP-EER-REQ-019, GAEP-EER-REQ-020, GAEP-EER-REQ-021, GAEP-EER-REQ-026, GAEP-EER-REQ-027, GAEP-EER-REQ-028, GAEP-EER-REQ-029 | cancellation, compensation, quarantine, recovery, degraded mode, and reconciliation mechanics | Operational Resilience and Incident Profiles | partial and uncertain effects remain visible, attributable, contained, and reauthorized before resume | extraction-required | Incident and Continuity Authority / unassigned |
| `GAEP-EXT-009` | GAEP-EER-REQ-023, GAEP-EER-REQ-024, GAEP-EER-REQ-025 | credential brokerage, untrusted output mediation, and control-record isolation | Security Runtime Realization | constrained actors cannot modify the controls, evidence, or credentials governing their own effects | extraction-required | GAEP Security Authority / unassigned |
| `GAEP-EXT-010` | GAEP-ECF-REQ-001, GAEP-ECF-REQ-002, GAEP-ECF-REQ-003, GAEP-ECF-REQ-004, GAEP-ECF-REQ-005, GAEP-ECF-REQ-006, GAEP-ECF-REQ-007, GAEP-ECF-REQ-008, GAEP-ECF-REQ-009, GAEP-ECF-REQ-010 | extension installation, publisher, dependency, permission, distribution, and supply-chain mechanics | Extension and Supply-Chain Profile | presence or installation never implies trust, approval, or authorization | extraction-required | GAEP Distribution and Ecosystem Owner / unassigned |
| `GAEP-EXT-011` | GAEP-ECF-REQ-011, GAEP-ECF-REQ-012, GAEP-ECF-REQ-013, GAEP-ECF-REQ-014, GAEP-ECF-REQ-015, GAEP-ECF-REQ-016, GAEP-ECF-REQ-017, GAEP-ECF-REQ-018, GAEP-ECF-REQ-019, GAEP-ECF-REQ-020 | compatibility negotiation, provider aliasing, migration, import/export, and adapter mechanics | Compatibility and Adapter Realization | unsupported or lossy semantics remain explicit and cannot be normalized to success | extraction-required | GAEP Integration Steward / unassigned |
| `GAEP-EXT-012` | GAEP-ECF-REQ-021, GAEP-ECF-REQ-022, GAEP-ECF-REQ-023, GAEP-ECF-REQ-024, GAEP-ECF-REQ-025, GAEP-ECF-REQ-026, GAEP-ECF-REQ-027, GAEP-ECF-REQ-028, GAEP-ECF-REQ-029 | federation agreement, cross-domain identity/policy/data, split-brain, revocation, and exit mechanics | Federation Profile and Realization | one authority domain never acquires or amplifies another domain's authority implicitly | extraction-required | Organizational Trust Authority / unassigned |
| `GAEP-EXT-013` | GAEP-ECF-OD-007 and marketplace language in GAEP-CORE-012 | marketplace governance, certification, transparency, attestation, and liability | Deferred Capability Register and future Ecosystem Profile | marketplace presence, certification, or attestation cannot imply GAEP approval or executable authority | defer-out-of-core | GAEP Distribution and Ecosystem Owner / unassigned |

## Complexity Exception

A Complexity Exception is not an ordinary Policy Exception. It is an approved architecture Decision Record that identifies:

- exact exceeded budget and exact Candidate Revision Set revision;
- concept or requirement retained and why the Core admission test cannot be satisfied through extraction;
- evidence from the required profile and realization diversity;
- added authoring, implementation, assurance, migration, and adoption cost;
- consolidation or removal offset;
- owner, expiry, review trigger, and success/failure evidence;
- dissent and alternatives;
- exact Approval Determination.

An exception cannot be standing, silent, inherited, or renewed automatically.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-BOUNDARY-REQ-001 | The candidate-baseline gate SHALL calculate every budget from the exact Candidate Revision Set revision and SHALL block approval while any budget is exceeded, unresolved, or calculated from mutable inputs. | Exact-set budget calculation |
| GAEP-BOUNDARY-REQ-002 | A Core concept or requirement SHALL satisfy every Core admission-test condition or SHALL be extracted before baseline approval. | Admission-evidence review |
| GAEP-BOUNDARY-REQ-003 | A provider-, AI-, workflow-engine-, retry-, marketplace-, distribution-, adapter-, or federation-specific mechanic SHALL NOT remain normative Core merely because several current documents use it. | Mechanic-specificity review |
| GAEP-BOUNDARY-REQ-004 | Extraction SHALL preserve the minimal constitutional invariant, exact trace from old requirement IDs to target contracts, migration disposition, and conformance impact. | Extraction trace audit |
| GAEP-BOUNDARY-REQ-005 | Every `extraction-required` row SHALL close through exact target contract revisions and revised Core requirements before the candidate-baseline gate can pass. | Extraction-closure validation |
| GAEP-BOUNDARY-REQ-006 | A Complexity Exception SHALL bind one exact exceeded budget and Candidate Revision Set revision, SHALL satisfy the declared evidence fields, SHALL expire, and SHALL NOT authorize unrelated budget excess. | Exception-scope review |
| GAEP-BOUNDARY-REQ-007 | Open Decisions affecting the Core boundary SHALL be reconciled with GAEP-REG-009 and SHALL either close or receive an approved non-blocking deferral before baseline approval. | Open-decision boundary crosswalk |
| GAEP-BOUNDARY-REQ-008 | Core reduction SHALL NOT collapse Authority Grant with Authorization Grant, Review with Evaluation, Candidate Revision Set with Baseline Set, or orthogonal state dimensions. | Semantic-preservation negative tests |
| GAEP-BOUNDARY-REQ-009 | Current counts and extraction dispositions SHALL be regenerated after every material Core revision; stale counts SHALL block the gate. | Change-triggered recount |
| GAEP-BOUNDARY-REQ-010 | Passing the complexity budget SHALL NOT by itself establish semantic completeness, approval, conformance, implementation readiness, security, or fitness for use. | Budget-inference negative test |

## Current gate result

`blocked` — contract count, requirement count, per-contract maximum, entity inventory, extraction closure, and Open Decision classification do not satisfy the candidate gate.
