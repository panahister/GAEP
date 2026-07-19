---
id: GAEP-STR-002
title: Problem Evidence and Theory of Change
document_type: product-strategy
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Research Owner
scope: GAEP problem validation, claims, hypotheses, evidence, and causal model
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
  - ../../06_Roadmap/052_ADOPTION_GUIDE.md
supersedes: []
---

# Problem Evidence and Theory of Change

## Status and purpose

This document defines how GAEP distinguishes observed problems from plausible stories and how it will test whether the proposed product causes useful outcomes. It is Proposed and not approved. It contains no claim that a market, organization, or user has validated GAEP.

## Epistemic vocabulary

| Term | Meaning |
|---|---|
| Observation | A recorded event, behavior, or source statement with provenance and scope |
| Evidence | Information assessed for relevance, credibility, recency, and limitations |
| Hypothesis | A falsifiable expectation that connects a condition, intervention, and outcome |
| Assumption | A proposition temporarily used to proceed but not yet adequately evidenced |
| Claim | A statement presented for evaluation and linked to evidence or an explicit evidence gap |
| Finding | A conclusion supported to a declared confidence within a defined scope |
| Decision | An accountable selection among alternatives; not made true merely by evidence volume |
| Unknown | Material information not currently known or available |

Evidence does not automatically create authority. An authoritative decision may still be wrong, and strong evidence from one context may not generalize to another.

## Current evidence boundary

The current candidate baseline is supported primarily by:

- the legacy GAEP Draft corpus;
- internal conceptual analysis of that corpus;
- generally recognizable engineering-governance failure modes;
- Proposed models and scenarios authored during restructuring.

This is adequate to form research hypotheses. It is not adequate to claim product demand, workflow fitness, reduced delivery risk, economic return, or organizational adoption. No interview corpus, historical-case dataset, observed live workflow, external pilot, or approved outcome baseline is present in this candidate document.

## Candidate problem domains

### Problem hypothesis 1 — context reconstruction

Material engineering work may require participants to reconstruct the same initiative purpose, constraints, architecture, assurance obligations, and prior decisions repeatedly across conversations and tools.

Potential consequences include delay, inconsistent assumptions, omission of governing constraints, and dependence on individual memory.

### Problem hypothesis 2 — fragmented authority and decision evidence

Artifacts may exist in multiple repositories and external systems while ownership, status, authority, considered evidence, approval scope, and supersession are difficult to reconstruct.

Potential consequences include implicit approval, duplicated truth, stale decisions, and audit work that depends on oral history.

### Problem hypothesis 3 — accelerated drift

AI may increase the speed at which requirements, diagrams, code, tests, and documents are created without ensuring that upstream intent and downstream evidence remain coherent.

Potential consequences include architecture drift, incomplete impact analysis, post-approval rework, and false confidence from fluent output.

### Problem hypothesis 4 — governance that is either absent or too heavy

Organizations may respond to AI risk with informal trust or universal ceremony. Neither response reliably matches control to reversibility, sensitivity, blast radius, or cost of failure.

Potential consequences include unsafe automation, approval theater, long lead times, workarounds, and shadow AI use.

### Problem hypothesis 5 — tool-bound memory and control

Provider-specific instructions, histories, and controls may not preserve portable decision, evidence, and authority semantics when teams change tools.

Potential consequences include lock-in, loss of context, inconsistent controls, and expensive migration.

## Problem priority is unresolved

The five domains above must not be treated as equally urgent or as one indivisible problem. Research must determine:

- which problem occurs most frequently;
- which causes material harm or avoidable effort;
- who feels the pain and who owns its outcome;
- whether the pain is already solved adequately;
- whether GAEP can change the outcome without unacceptable burden;
- which problem creates a repeatable entry point into the larger model.

## Existing alternatives to observe

Problem research must document what participants do today, including:

- individual or team memory;
- repository documentation and contribution rules;
- pull-request review and branch protection;
- architecture, backlog, design, assurance, governance, and operational systems;
- agent- or vendor-specific rule files and approval controls;
- checklists, templates, review boards, policy-as-code, and audit procedures;
- manual coordination by experienced staff;
- accepting the risk or doing nothing.

The relevant comparison is not an idealized GAEP future against a deliberately weak status quo. It is GAEP against the best feasible composition of existing practices for the selected segment.

## Proposed theory of change

The following causal chain is a hypothesis:

1. **Inputs:** accountable owners identify authoritative sources, change scope, applicable policy, risk, and current state.
2. **Mechanism:** GAEP represents authority, claims, evidence, decisions, state, and trace through portable semantics and proportionate profiles.
3. **Changed behavior:** participants inspect current context, disclose unknowns, review meaningful deltas, and record version-bound decisions rather than relying on private conversational memory.
4. **Immediate outputs:** decision-ready change packages, explicit blockers, attributable approval, evidence manifests, and visible downstream obligations.
5. **Intermediate outcomes:** less context reconstruction, earlier impact discovery, better review focus, less implicit approval, and safer tool substitution.
6. **Engineering outcomes:** reduced post-approval rework and drift, improved assurance, and shorter learning loops where the workflow is applicable.
7. **Organizational value:** faster trustworthy change, lower coordination cost, safer AI adoption, and more durable organizational memory.

Each arrow is independently falsifiable. For example, portable semantics may increase authoring burden without changing reviewer behavior, or better evidence may improve auditability without improving delivery speed.

## Counter-hypotheses and failure modes

| Counter-hypothesis ID | Counter-hypothesis | Observable warning |
|---|---|---|
| GAEP-STR-CH-001 | Existing repository and review practices already solve the selected problem adequately. | GAEP adds no material finding or time reduction |
| GAEP-STR-CH-002 | The information required to govern change cannot be kept current at acceptable cost. | High stale rate or steward effort |
| GAEP-STR-CH-003 | Users route work around explicit governance. | Shadow workflows and incomplete records increase |
| GAEP-STR-CH-004 | Reviewers do not use the additional trace and evidence. | Decision quality is unchanged while review time rises |
| GAEP-STR-CH-005 | Vendor neutrality creates abstraction cost without practical portability value. | Provider-change scenarios show no meaningful benefit |
| GAEP-STR-CH-006 | One semantic model cannot fit product and non-product work without becoming vague or burdensome. | Profiles diverge or require extensive exceptions |
| GAEP-STR-CH-007 | Recorded execution evidence is perceived or used as employee surveillance. | Trust declines or participation becomes defensive |
| GAEP-STR-CH-008 | Experienced facilitation, not GAEP, causes pilot improvement. | Benefits disappear when facilitation is reduced |
| GAEP-STR-CH-009 | Formal approval increases diffusion of responsibility or rubber stamping. | Approvals rise while useful findings fall |

## Evidence program before implementation

### 1. Problem interviews

Interview sponsors, change owners, engineers, reviewers, stewards, and assurance participants separately. Capture recent specific events rather than preference for a proposed solution.

Questions should identify:

- the last consequential change of the relevant type;
- sources consulted and time spent finding them;
- missing or conflicting information;
- who made which decision and how that was recorded;
- rework, delay, escaped impact, or accepted risk;
- the existing workaround and its strengths;
- willingness and authority to change the workflow.

### 2. Historical-case reconstruction

Select completed changes from the target segment. Reconstruct intent, sources, decisions, review, implementation, evidence, outcomes, and later rework. Record unavailable evidence as a result, not as zero impact.

### 3. Manual or concierge workflow

Exercise the governed-change workflow without a production implementation. Use current tools and manual facilitation to determine whether the semantics improve the work and what hidden labor they require.

### 4. Comparative evaluation

Compare GAEP with the actual incumbent workflow. When feasible, use matched changes, a prior-period baseline, repeated tasks, or independent reviewers. Record selection, novelty, facilitator, and learning effects.

### 5. Product and non-product cases

Use at least one bounded Initiative targeting a Product Managed Asset and one bounded Initiative targeting a non-Product Managed Asset before claiming Initiative neutrality. The cases should share the Core semantics but differ in applicable Profiles.

### 6. Adversarial scenarios

Evaluate missing ownership, stale approval, conflicting authorities, unavailable external sources, urgent change, rejected recommendations, low-risk work, sensitive data, provider substitution, and pause or exit.

## Evidence-quality dimensions

Every material item should be assessed against:

- **provenance:** where it came from and who produced it;
- **directness:** whether it observes the relevant behavior or only reports opinion;
- **scope:** segment, workflow, initiative, and time period;
- **recency:** whether the context remains applicable;
- **independence:** whether author, facilitator, reviewer, and beneficiary are separated;
- **completeness:** known omissions and unavailable sources;
- **reproducibility:** whether another reviewer can follow the method;
- **limitations:** bias, confounding, uncertainty, and transfer limits.

Confidence labels, if used, must state their basis. Numeric precision must not conceal weak evidence.

## Hypothesis register

| Hypothesis ID | Hypothesis | Falsifying or weakening evidence | Current state |
|---|---|---|---|
| GAEP-STR-HYP-001 | Bounded trusted context reduces time spent reconstructing material change context. | No reduction or increased total effort after facilitator time | open |
| GAEP-STR-HYP-002 | Explicit authority and decision semantics reduce ambiguous or stale approval. | Approval ambiguity is unchanged or users bypass the record | open |
| GAEP-STR-HYP-003 | Impact and evidence linkage improves reviewer findings before implementation. | Useful findings do not improve after controlling for review time | open |
| GAEP-STR-HYP-004 | Risk profiles reduce burden compared with universal governance. | Low-risk lead time or author effort remains excessive | open |
| GAEP-STR-HYP-005 | Portable semantics preserve useful memory across AI-tool substitution. | A provider change gains no meaningful continuity over ordinary files | open |
| GAEP-STR-HYP-006 | The governed-change workflow provides repeat value across initiative types. | Product and non-product cases require incompatible Core meaning | open |
| GAEP-STR-HYP-007 | Transparent evidence controls can improve trust without enabling worker surveillance. | Participants report defensive behavior or data is used for individual productivity scoring | open |

## Normative evidence rules

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STR-EVD-REQ-001 | Every material product claim SHALL be labeled as observed, evidenced finding, hypothesis, assumption, decision, or unknown. | Claim-register review |
| GAEP-STR-EVD-REQ-002 | A demonstrated-outcome claim SHALL identify evidence provenance, method, scope, limitations, and the subject versions or workflow evaluated. | Evidence-package review |
| GAEP-STR-EVD-REQ-003 | Missing, conflicting, negative, or disconfirming evidence SHALL NOT be omitted from a decision package. | Research audit |
| GAEP-STR-EVD-REQ-004 | Product-value evidence SHALL include participant burden and facilitator effort; hidden expert labor SHALL NOT be treated as zero cost. | Time and cost record review |
| GAEP-STR-EVD-REQ-005 | Research involving people SHALL define consent, confidentiality, permitted use, access, retention, and reporting boundaries before collection. | Research-protocol review |
| GAEP-STR-EVD-REQ-006 | Evidence collected for product learning SHALL NOT be repurposed for individual employee performance evaluation without a separate lawful, transparent, and approved basis. | Use-policy audit |
| GAEP-STR-EVD-REQ-007 | A cross-segment or cross-initiative generalization SHALL state the transfer rationale and contradictory cases. | Finding review |
| GAEP-STR-EVD-REQ-008 | Product implementation readiness SHALL require evidence from an observed or manually exercised first workflow; conceptual completeness alone SHALL NOT satisfy the gate. | Readiness-gate review |

## Pivot, narrow, or stop signals

The product decision authority should narrow, pivot, or stop investment when evidence shows one or more of the following and no bounded correction is credible:

- the selected pain is infrequent or already solved adequately;
- total governance burden exceeds measured value;
- authoritative context cannot be accessed or maintained;
- users do not repeat the workflow without exceptional facilitation;
- review quality does not improve and lead time increases materially;
- the Core cannot remain coherent across the selected cases;
- the product requires duplicate truth as its normal operating model;
- security, privacy, workforce trust, or legal constraints cannot be satisfied;
- a simpler composition of existing tools produces equal or better outcomes;
- no accountable owner or sustainable operating capacity exists.

## Open research decisions

| Decision ID | Open decision |
|---|---|
| GAEP-STR-EVD-DEC-001 | Which segment and workflow form the first evidence cohort? |
| GAEP-STR-EVD-DEC-002 | What historical sample and comparison method are feasible? |
| GAEP-STR-EVD-DEC-003 | Which independent roles review research quality and product claims? |
| GAEP-STR-EVD-DEC-004 | What evidence repository, access boundary, and retention period are approved? |
| GAEP-STR-EVD-DEC-005 | Which thresholds constitute proceed, narrow, pivot, or stop? |
| GAEP-STR-EVD-DEC-006 | How much transfer evidence is required before claiming initiative neutrality? |

No answer is implied by this document. Each decision requires an owner, exact scope, evidence, and version-bound approval.
