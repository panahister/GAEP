---
id: GAEP-STR-003
title: Users, Stakeholders, and Jobs
document_type: product-strategy
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Research Owner
scope: GAEP user system, stakeholder effects, jobs, incentives, and experience obligations
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
  - ../../000_READ_FIRST.md
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../06_Roadmap/052_ADOPTION_GUIDE.md
supersedes: []
---

# Users, Stakeholders, and Jobs

## Status and purpose

This Proposed document models the people and organizations affected by GAEP. It does not assert that the candidate users have been validated, that every organization contains these job titles, or that named governance roles require separate people.

GAEP is a multi-participant product. The person who funds adoption, the person who prepares a change, the person who reviews it, the person who maintains the workspace, and the person whose data or work is represented may all be different.

## Role, persona, identity, and authority

- A **role** is a bounded responsibility exercised in a declared scope.
- A **persona hypothesis** describes recurring goals, constraints, behaviors, and context for research and design.
- An **identity** is an attributable human, service, or other actor resolved by an approved authority.
- **Authority** is permission to decide or act on a subject; it is not created by job title, repository access, or system capability alone.
- One person may exercise several roles when policy permits.
- Several people may share work, but accountable decision ownership must remain identifiable.

GAEP must not encode one organization's titles as universal semantics. For example, an architecture decision may be owned by a technical lead in one organization and an architecture authority in another.

## Candidate stakeholder system

| Stakeholder | Core job | Exposure or concern | Candidate success signal |
|---|---|---|---|
| Investment sponsor | Decide whether GAEP deserves continued investment | Cost, risk, organizational disruption, strategic fit | Evidence supports proceed, narrow, pivot, or stop |
| GAEP Product Owner | Select the product problem and outcome priorities | Scope expansion, competing constituencies | A coherent first workflow produces measured value |
| Adoption owner | Introduce GAEP into a real initiative | Change fatigue, local resistance, duplicate ceremony | Existing work is replaced and repeat use occurs |
| Change owner | Prepare a consequential change | Missing context, unclear readiness, coordination load | A decision-ready package is created with less rework |
| Engineer or analyst | Understand and execute bounded work, with or without AI | Context switching, hidden constraints, surveillance | Less repeated explanation and clear next actions |
| Reviewer | Evaluate fitness, impact, and evidence | Information overload, rubber stamping, liability | Relevant deltas and unknowns are visible |
| Approver | Make an accountable decision | Ambiguous scope, stale evidence, false urgency | Decision is bounded, informed, attributable, and revisitable |
| Workspace steward | Keep governed references and state interpretable | Staleness, migration, support burden | Ownership and freshness work is sustainable |
| Profile or policy owner | Define proportionate obligations | Overcontrol, inconsistency, exceptions | Profiles are understandable and produce useful controls |
| Security, privacy, legal, or ethics authority | Protect people, data, systems, and obligations | External transmission, misuse, unlawful processing | Risks and permissions are evaluated before exposure |
| Assurance participant | Establish warranted confidence | Evidence gaps, false precision, unverifiable claims | Claims trace to fit-for-purpose evidence |
| Operator or incident responder | Operate and recover affected systems | Incomplete handoff, irreversible effect, unclear ownership | Change and recovery obligations are visible |
| Audit or oversight participant | Reconstruct a decision and its evidence | Missing provenance, excessive sensitive data | Relevant evidence is attributable and access-controlled |
| Affected contributor | Performs work represented in GAEP evidence | Loss of autonomy, monitoring, blame, extra administration | Use is transparent, proportionate, and contestable |
| External-system owner | Maintains an authoritative source integrated by reference | Duplication, stale synchronization, unauthorized access | Authority and conflict boundaries remain explicit |

## Candidate first-user hypotheses

### Change owner

**Context:** owns or coordinates a material engineering change that crosses several sources, decisions, or review domains.

**Functional job:** prepare the smallest complete package needed for a reliable decision and later execution.

**Emotional job:** avoid being surprised by a hidden constraint or blamed for an authority or evidence gap that was not visible.

**Social job:** demonstrate responsible engineering without producing performative documentation.

### Reviewer or approver

**Context:** must decide under limited attention and may be accountable for specialized risk.

**Functional job:** understand what changed, why, which sources govern, what remains unknown, and what conditions apply.

**Emotional job:** avoid both careless approval and becoming a bottleneck.

**Social job:** provide qualified challenge that adds value rather than ceremony.

### Workspace steward

**Context:** maintains the interpretability, compatibility, and health of governed records and references.

**Functional job:** identify broken ownership, stale state, invalid links, incompatible versions, and migration obligations.

**Emotional job:** avoid becoming the invisible manual integration layer for every team.

**Social job:** enable local autonomy while protecting shared meaning.

### Sponsor or adoption owner

**Context:** decides whether the organizational change is worth funding and continuing.

**Functional job:** compare delivery value, risk reduction, trust, burden, and total operating cost.

**Emotional job:** avoid a high-visibility AI-governance program that becomes compliance theater.

**Social job:** demonstrate accountable AI adoption without claiming certainty unsupported by evidence.

## Primary job-to-be-done

> When a consequential engineering change must be prepared with AI assistance across fragmented sources and authorities, help the responsible participants establish the trusted context, impact, evidence, uncertainty, and decision boundary so that an accountable decision can be made and later reconstructed without unnecessary duplicate work.

This job is a hypothesis. It is selected for research because it involves recurring coordination, several stakeholder types, and a bounded outcome. It does not imply that every change requires the same depth.

## Supporting jobs

- determine whether GAEP or a profile is applicable at all;
- find the authoritative source for a claim without copying it unnecessarily;
- distinguish approved fact, proposal, assumption, and unknown;
- understand why work is blocked and what can resolve it;
- review only material deltas and their downstream effects;
- record approval, conditions, rejection, or deferral against exact subjects;
- hand work to another participant or tool without losing meaning;
- identify stale, superseded, or invalid evidence and decisions;
- learn from outcomes without automatically universalizing one local result;
- pause or exit GAEP while preserving portable records.

## Candidate experience sequence

| Moment | User question | Required experience property |
|---|---|---|
| Orientation | What is GAEP, and does it apply to this work? | Short explanation, eligibility, non-goals, and effort expectation |
| Intake | What change, subject, owner, and outcome are in scope? | Bounded language and visible unknowns |
| Authority resolution | Which policies, sources, and people govern? | Provenance and conflict disclosure |
| Context preparation | What is necessary for this job? | Minimum sufficient context and visible omissions |
| Analysis | What changes, what might break, and what alternatives exist? | Evidence, uncertainty, and role-bounded challenge |
| Review | What deserves my attention? | Delta-first presentation and risk-based depth |
| Decision | What am I authorizing, rejecting, or conditioning? | Exact scope, subject version, validity, and obligations |
| Handoff | What may happen next, and who owns it? | Explicit state and actionable next steps |
| Evolution | What became stale or must be reconsidered? | Change-driven re-evaluation without indiscriminate regeneration |
| Exit | How can work continue without this realization or provider? | Portable meaning and documented fallback |

## Stakeholder tensions to design for

| Tension | Risk if ignored | Product response to evaluate |
|---|---|---|
| Speed versus evidence | Hidden risk or governance delay | Risk-proportionate profiles and explicit residual risk |
| Local autonomy versus shared semantics | Fragmentation or central overreach | Stable Core with bounded organizational bindings |
| More trace versus less administration | Documentation burden | Trace only where a decision, impact, evidence, or navigation job requires it |
| Rich evidence versus privacy | Surveillance or sensitive disclosure | Purpose limitation, minimization, access, and retention |
| Reviewer completeness versus attention | Rubber stamping | Delta-first review and defined evidence sufficiency |
| Portability versus provider advantage | Weak abstraction or lock-in | Core invariants plus declared adapter capabilities |
| Reuse versus contextual fitness | Copying unsuitable practice | Provenance, applicability, and local decision authority |
| Human accountability versus automation | Approval theater | Authority, competence, workload, and meaningful options |

## Organizational role-composition hypotheses

GAEP should support composition without pretending conflicts disappear:

- **Small-team profile:** one person may combine product, change-owner, and steward work; material approval still requires an appropriately independent authority where risk demands it.
- **Standard profile:** product, technical, assurance, and operational responsibilities may be distributed across a delivery team and enabling functions.
- **Enterprise profile:** shared semantic and policy ownership coexists with initiative-local decisions and federated sources.
- **Regulated or high-consequence profile:** independence, segregation, retention, competence, and evidence obligations may be stronger.

The exact profiles are not selected here. A profile cannot convert absence of competent authority into permission.

## Incentives and adoption behavior

GAEP may fail even when its semantics are correct. Research and operating design must account for:

- pressure to hide uncertainty to avoid delay;
- incentives to maximize completed artifacts or approvals;
- reviewer overload and diffusion of responsibility;
- local fear that central governance will remove decision rights;
- fear that AI or evidence telemetry will be used to rank employees;
- invisible maintenance work assigned to stewards;
- shadow use when approved paths are slower than ordinary work;
- leadership behavior that rewards speed while publicly requesting rigor.

Positive reinforcement should recognize early risk discovery, honest uncertainty, useful reuse, simplification, and removal of obsolete ceremony. Product metrics must not become individual productivity metrics.

## Accessibility, inclusion, and power

GAEP affects people with different language, accessibility, technical, organizational, and authority contexts. Its product design must consider:

- accessible navigation and review representations;
- plain-language explanations alongside controlled terminology;
- time-zone and asynchronous decision needs;
- contributors who cannot access every source;
- safe challenge and appeal when authority is wrong or incomplete;
- contractors, partners, and affected people outside the core team;
- power imbalance between sponsor, approver, reviewer, and contributor;
- localization and jurisdictional obligations when applicable.

## Normative stakeholder rules

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STR-USR-REQ-001 | Every selected first workflow SHALL identify sponsor, change owner, users, reviewers, approver, steward, affected non-users, and external authority owners as applicable. | Stakeholder-map review |
| GAEP-STR-USR-REQ-002 | A role name SHALL NOT be treated as proof of identity, competence, or authority. | Decision-right review |
| GAEP-STR-USR-REQ-003 | A user experience SHALL disclose why information, review, evidence, or approval is requested and what consequence follows from omission. | Scenario demonstration |
| GAEP-STR-USR-REQ-004 | GAEP adoption SHALL identify which existing activity is replaced, retained, or added; new ceremony SHALL NOT be presented as zero-cost. | Before-and-after workflow review |
| GAEP-STR-USR-REQ-005 | Review and approval design SHALL account for human attention, competence, independence, delegation, absence, escalation, and decision latency. | Approval-workload scenario |
| GAEP-STR-USR-REQ-006 | Evidence about individual work SHALL be purpose-limited, access-controlled, and excluded from individual productivity ranking unless a separate lawful and transparent decision explicitly authorizes that use. | Data-use audit |
| GAEP-STR-USR-REQ-007 | A participant SHALL have a defined path to challenge incorrect context, authority, policy application, evidence, or state without changing it silently. | Contestability scenario |
| GAEP-STR-USR-REQ-008 | First-horizon usability evaluation SHALL include change owners, reviewers, stewards, and at least one affected contributor; sponsor approval alone SHALL NOT establish usability. | Research-participant review |
| GAEP-STR-USR-REQ-009 | Role composition SHALL preserve any applicable separation-of-duty and conflict-of-interest obligations. | Effective-profile review |
| GAEP-STR-USR-REQ-010 | GAEP documentation and review experiences SHALL provide progressive disclosure appropriate to participant job and decision scope. | Role-journey inspection |

## Open decisions

| Decision ID | Open decision |
|---|---|
| GAEP-STR-USR-DEC-001 | Which role is the first daily operator for the selected workflow? |
| GAEP-STR-USR-DEC-002 | Which organization profile is the first segment? |
| GAEP-STR-USR-DEC-003 | What minimum independent review is required in the first pilot? |
| GAEP-STR-USR-DEC-004 | What reviewer-attention and approval-latency budgets are acceptable? |
| GAEP-STR-USR-DEC-005 | Which workforce consultation, privacy, or labor obligations apply to pilot evidence? |
| GAEP-STR-USR-DEC-006 | What support and training are necessary for use without expert facilitation? |
| GAEP-STR-USR-DEC-007 | What accessible and localized forms are required for the first segment? |

These decisions require observed user evidence and accountable approval. Persona prose alone is not evidence.
