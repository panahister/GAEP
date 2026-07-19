---
id: GAEP-STR-007
title: GAEP Operating Model
document_type: product-strategy
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: Governance, ownership, support, funding, and evolution of GAEP itself
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
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md
  - ../../06_Roadmap/052_ADOPTION_GUIDE.md
supersedes: []
---

# GAEP Operating Model

## Status and purpose

This Proposed document defines how GAEP itself would be owned and governed. It does not appoint named people, create a council, allocate budget, establish employment responsibility, or authorize implementation or public distribution.

The operating model must distinguish two systems:

1. **governance of GAEP:** product strategy, constitutional stewardship, Core semantics, profiles, conformance, distribution, support, and investment;
2. **governance through GAEP:** initiative-local policy, authority, decision, evidence, approval, and execution using an approved GAEP release.

An initiative approver is not automatically a GAEP constitutional owner. A GAEP specification steward is not automatically authorized to decide an initiative's business or engineering outcome.

## Operating objectives

The operating model should:

- keep constitutional and Core meaning stable enough for conformance and portability;
- allow evidence-based product narrowing and evolution;
- prevent central semantic ownership from absorbing initiative decision rights;
- maintain profiles, guidance, examples, and compatibility;
- provide support without hiding total operating cost;
- resolve conflicts, appeals, security concerns, and harmful use;
- preserve negative evidence and stop-investment options;
- make every authority attributable, scoped, time-valid, and replaceable through governed succession.

## Candidate roles

Roles describe accountabilities; they do not require separate teams or people in every stage.

| Canonical candidate role | Accountable scope | Must not assume automatically |
|---|---|---|
| GAEP Investment Sponsor | Product investment, funding envelope, and stop-investment authority | Product evidence validity, constitutional amendment, or implementation permission |
| GAEP Constitutional Owner | Constitutional approval and amendment | Initiative decision authority or unilateral product funding |
| GAEP Product Owner | Product problem, target users, outcomes, scope, and roadmap | Constitutional amendment or independent conformance attestation |
| GAEP Product Research Owner | Problem, usability, outcome, burden, and alternative evidence | Approval of findings without method review |
| GAEP Specification Steward | Coherence, terminology, requirement IDs, dependency integrity, and release assembly | Product-value approval or local policy authority |
| GAEP Core Subject Owner | One bounded Core semantic area and its compatibility | Ownership of every profile using that subject |
| GAEP Profile Specification Steward | Semantic meaning of one Profile's applicability rules, obligations, evidence contract, conformance, and evolution | Authority to select the Profile for a scope or permission to weaken Core invariants |
| GAEP Conformance Authority | Defined conformance evaluation and result | Product certification beyond declared authority |
| GAEP Decision and Authorization Steward | Integrity and separation of Decision, Approval, Gate Evaluation, Authorization Grant, and effect boundaries | Authority to select an outcome or grant permission solely by maintaining the process |
| GAEP Identity and Authority Steward | Role taxonomy, assignments, delegation, and accountable-human chains | Authority outside a valid assignment |
| GAEP Assurance Authority | Claim, evidence, assurance, evaluation, and gate method | Product investment or risk acceptance outside assigned scope |
| GAEP Audit Authority | Scoped audit coverage, integrity, reconstruction, correction, and independent challenge | Treating logs as proof of authorization, success, legality, or correctness |
| GAEP Risk Owner | Risk-register integrity, assessment method, treatment tracking, and review triggers | Residual Risk Acceptance without the designated authority |
| GAEP Security Authority | Security obligations and residual security-risk review | Privacy, legal, operational, or product authority outside assigned scope |
| GAEP Data, Privacy, and Records Authority | Data purpose, privacy, classification, retention, deletion, and records obligations | AI, legal, or product authority outside assigned scope |
| GAEP AI System Authority | AI use case, autonomy, evaluation, provider, drift, and human oversight | Product approval, data authorization, or supplier approval by itself |
| GAEP Operational Authority | Service, support, incident, continuity, recovery, capacity, and retirement | Product investment or security acceptance outside assigned scope |
| GAEP Incident and Continuity Authority | Material incident declaration, coordinated response, evidence custody, communication, continuity, recovery, closure, and reopening | Universal control over routine events or unrelated domain decisions |
| GAEP Legal, IP, and Supplier Authority | Ownership, licensing, contracts, supplier terms, jurisdiction, and distribution constraints | Product evidence or constitutional authority |
| GAEP Organizational Trust Authority | Workforce trust, accessibility, affected-person protection, ethics, and appeal | Universal authority over product or employment decisions |
| GAEP Adoption Owner | Pilot adoption, training, workflow replacement, support, and feedback | Power to mandate adoption without sponsor and local authority |
| GAEP Distribution and Ecosystem Owner | License packaging, contribution, compatibility, marks, and external relationships | Authority to publish unapproved claims or assets |
| GAEP Workspace Steward | Repository representation, external mappings, freshness, validation, migration, and portability | Content approval or source ownership solely through write access |
| GAEP Metric Integrity Owner | Metric contracts, data quality, anti-gaming, privacy coordination, and reporting integrity | Product investment selection or unrelated data use |
| GAEP Initiative Owner | Governed local outcome and applicability | Ability to redefine GAEP Core semantics |
| GAEP Independent Reviewer | Qualified challenge of a declared subject | Final approval unless separately assigned and authorized |

Each role needs an identified appointing authority, scope, competence expectations, delegation rule, backup, conflict policy, and succession plan before it is operational.

## Candidate decision forums

Forums are optional organizational forms. Small organizations may combine them while preserving decision boundaries.

### Product and Evidence Review

Purpose:

- review problem evidence, user outcomes, burden, economics, and alternatives;
- decide proceed, narrow, pivot, pause, or stop recommendations;
- prioritize product experiments rather than specification volume.

It does not amend the Constitution or approve a Core breaking change.

### Constitutional and Core Review

Purpose:

- assess constitutional amendments and Core semantic changes;
- review compatibility, affected profiles, conformance, migration, and unresolved conflict;
- protect requirement identity and authority boundaries.

It does not select a commercial model or initiative implementation architecture.

### Profile and Practice Review

Purpose:

- review profile applicability, burden, exceptions, evidence, and local learning;
- prevent one successful local practice from becoming universal without transfer evidence;
- recommend profile addition, change, deprecation, or retirement.

### Risk and Responsible-Use Review

Purpose:

- address security, privacy, records, legal, ethical, workforce, and harmful-use concerns;
- review sensitive research and evidence use;
- define pause or stop conditions within delegated authority.

### Release Readiness Review

Purpose:

- verify exact version set, dependencies, metadata, open deviations, approvals, migration, evidence, and communication;
- decide whether a candidate may become an approved or baselined release.

Release assembly does not create missing substantive authority.

## Candidate decision-right map

| Decision | Accountable role | Required consultation or evidence | Separate approval concern |
|---|---|---|---|
| Product segment and first workflow | GAEP Product Owner | Research, sponsor, adoption, and affected-user evidence | Investment authority |
| Product investment | GAEP Investment Sponsor | Outcomes, burden, economics, risks, alternatives | May condition scope and budget |
| Constitutional amendment | GAEP Constitutional Owner | Specification, product, risk, compatibility, and affected authorities | Version-bound constitutional approval |
| Core requirement change | GAEP Core Subject Owner within delegated process | Profile impact, conformance, migration, scenarios | Release approval |
| Profile semantic change | GAEP Profile Specification Steward | Core conformance, user burden, evidence, affected initiatives, and compatibility | Release approval; does not select the Profile for a scope |
| Profile selection or adoption | Applicable domain decision authority and GAEP Initiative Owner | Profile Selection Manifest, applicability evidence, conflicts, burden, and affected participants | Organizational or initiative binding |
| Conformance result | GAEP Conformance Authority | Declared method, evidence, deviations | Certification or mark authority if any |
| Public product claim | GAEP Product Owner | Claim evidence and distribution review | Legal, brand, or publication authority |
| Research data use | GAEP Product Research Owner | Consent, privacy, security, retention, affected participants | GAEP Data, Privacy, and Records Authority |
| Pilot adoption | GAEP Initiative Owner and GAEP Investment Sponsor | Product, adoption, security, and local-role readiness | Local decision rights remain local |
| Candidate baseline | GAEP Specification Steward prepares; approving authority remains unassigned | Exact document set, gate result, approvals, dependencies, migrations | Baseline approval does not approve implementation automatically |

The role types above are candidate canonical names under `GAEP-DEC-018`. No accountable identity, appointing authority, delegation, approval composition, or authority interval is assigned by this table. The actual assignments remain open.

## Operating cycles

### Product discovery cycle

1. collect observed problems and counterevidence;
2. maintain hypothesis and decision registers;
3. select a bounded experiment;
4. measure value, burden, trust, cost, and limitations;
5. decide proceed, narrow, pivot, pause, or stop;
6. update strategy and scope with trace.

### Specification change cycle

1. register change intent and owner;
2. identify affected requirements, terms, profiles, examples, conformance claims, and migrations;
3. analyze alternatives and compatibility;
4. conduct qualified and affected-party review;
5. record version-bound decision;
6. assemble and validate candidate release;
7. communicate, migrate, observe, and reopen when triggers occur.

### Adoption learning cycle

1. establish incumbent baseline and local authority map;
2. select one workflow and applicable profile;
3. state which current work is replaced, retained, or added;
4. train and support the participants;
5. perform the workflow and record hidden facilitation;
6. collect outcomes, burden, trust, and exceptions;
7. return local learning as evidence, not universal law;
8. decide expansion, repetition, tailoring, pause, or exit.

## Intake and prioritization

GAEP changes may originate from user pain, conformance defect, security concern, profile evidence, compatibility need, legal obligation, implementation feedback, external-system evolution, or editorial defect.

Prioritization should consider:

- constitutional or legal urgency;
- affected users and severity;
- first-workflow outcome impact;
- evidence strength and uncertainty;
- conformance and compatibility impact;
- risk of continued ambiguity;
- adoption and operating burden;
- availability of a simpler correction;
- migration and support capacity;
- whether deferral preserves a safe coherent product.

Popularity and author seniority are not sufficient priority criteria.

## Support and enablement model

Before operational adoption, GAEP needs a declared service model covering:

- orientation and eligibility assessment;
- role-based learning outcomes and examples;
- workflow tailoring and applicability support;
- specification interpretation and clarification;
- incident, security, privacy, and harmful-use reporting;
- conformance and migration assistance;
- known limitations and compatibility notices;
- office hours or another escalation route;
- response targets proportionate to consequence;
- supported, deprecated, and retired version policy;
- fallback when support or a realization is unavailable.

Support effort must be measured as product cost. Expert intervention that makes a pilot succeed is not evidence of self-sufficient usability.

## Federated operation

Candidate federation model:

- the Constitution and Core protect stable shared meaning;
- profiles define approved specializations and variation points;
- organizations bind authorities, policies, sources, and thresholds;
- initiatives decide applicability and outcomes within those bindings;
- realizations and adapters declare conformance and limitations;
- evidence may challenge any layer through its defined change process.

Higher authority does not justify central ownership of every local decision. Local autonomy does not justify silent semantic divergence.

## Conflict, appeal, and deadlock

The operating model must support:

- conflict between product value and constitutional obligation;
- conflicting specialized authorities;
- unavailable or overloaded approvers;
- incorrect policy or profile application;
- disputed evidence or conformance results;
- conflicts of interest;
- urgent safety, security, or operational action;
- appeal by an affected contributor;
- unresolved deadlock and explicit stop.

An escalation path may change who decides, but it must not erase the original conflict, evidence, dissent, or time pressure. Emergency action must be bounded and reviewed retrospectively.

## Capacity and funding

An operational decision must identify:

- product, specification, research, adoption, profile, support, risk, and release capacity;
- which roles are combined and which require independence;
- funded time for stewardship and maintenance;
- shared versus initiative-local cost allocation;
- decision and support availability;
- succession and continuity;
- conditions under which insufficient capacity blocks expansion.

A role table without available accountable capacity is not an operating model.

## Normative operating requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STR-OPS-REQ-001 | Every operational GAEP authority SHALL identify accountable identity, role, scope, appointing authority, validity, delegation, conflict rule, and succession or backup. | Authority-record review |
| GAEP-STR-OPS-REQ-002 | Governance of GAEP SHALL remain distinguishable from initiative governance through GAEP. | Decision-right scenario |
| GAEP-STR-OPS-REQ-003 | Repository write, authorship, funding, facilitation, or technical capability SHALL NOT by itself establish approval authority. | Access-to-authority review |
| GAEP-STR-OPS-REQ-004 | A product, constitutional, Core, profile, conformance, distribution, or initiative decision SHALL be made only by the authority assigned to that subject and scope. | Decision-record validation |
| GAEP-STR-OPS-REQ-005 | Material dissent, conflict, recusal, and unresolved minority concern SHALL remain visible in the decision evidence. | Decision-package review |
| GAEP-STR-OPS-REQ-006 | Operational adoption SHALL identify funded stewardship, support, migration, risk, and decision capacity before expansion. | Capacity-gate review |
| GAEP-STR-OPS-REQ-007 | Pilot and support labor SHALL be measured and SHALL NOT be hidden as voluntary or incidental work. | Cost and capacity audit |
| GAEP-STR-OPS-REQ-008 | Every supported release SHALL define support scope, known limitations, compatibility, deprecation, incident path, and fallback. | Release-service review |
| GAEP-STR-OPS-REQ-009 | Local learning SHALL NOT become a Core or profile requirement without transfer evidence and the applicable change authority. | Requirement-provenance review |
| GAEP-STR-OPS-REQ-010 | Insufficient competent authority or operating capacity SHALL produce an explicit blocked, paused, or narrowed result rather than silent delegation. | Negative scenario test |
| GAEP-STR-OPS-REQ-011 | Emergency action SHALL identify owner, scope, reason, evidence, recovery, expiry, and retrospective review. | Emergency scenario review |
| GAEP-STR-OPS-REQ-012 | An affected participant SHALL have a defined reporting and appeal path for harmful, incorrect, or unauthorized GAEP use. | Responsible-use scenario |

## Open decisions

| Decision ID | Open decision |
|---|---|
| GAEP-STR-OPS-DEC-001 | Who is the Proposed Constitution's accountable owner and appointing authority? |
| GAEP-STR-OPS-DEC-002 | Who owns GAEP product outcomes and investment? |
| GAEP-STR-OPS-DEC-003 | Which roles may be combined during the pre-implementation phase? |
| GAEP-STR-OPS-DEC-004 | What independent review is required for product evidence and conformance? |
| GAEP-STR-OPS-DEC-005 | What forums are necessary, and what simpler mechanisms can replace committees? |
| GAEP-STR-OPS-DEC-006 | What support and response commitments apply to the first pilot? |
| GAEP-STR-OPS-DEC-007 | How are shared and initiative-local costs funded? |
| GAEP-STR-OPS-DEC-008 | What is the appeal, deadlock, and emergency authority model? |
| GAEP-STR-OPS-DEC-009 | Who may approve a candidate baseline and separately authorize implementation? |

No role, forum, or authority is operational until these decisions are bound to identifiable accountable parties and exact scope.
