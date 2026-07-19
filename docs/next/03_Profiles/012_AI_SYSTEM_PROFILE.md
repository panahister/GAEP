---
id: GAEP-PROF-012
title: AI System Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: AI capabilities used by GAEP or governed through GAEP
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
  - GAEP-CORE-002
  - GAEP-CORE-007
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
informative_references: []
supersedes: []
---

# AI System Profile

## AI use-case record

Record purpose, users and affected persons, decisions or effects influenced, operating context, prohibited uses, model/provider/adapter versions, context and data, tools, autonomy, human oversight, expected benefit, harm scenarios, evaluations, monitoring, fallback, cost and retirement.

## Candidate autonomy classes

- **AI-0:** no AI required; manual or deterministic path.
- **AI-1:** informational assistance with no authoritative output or external effect.
- **AI-2:** drafts or recommendations requiring human validation before authority.
- **AI-3:** bounded effects under explicit effect-level authorization and validation.
- **AI-4:** delegated effects inside an approved policy envelope with continuous constraints, monitoring and revocation.

The class describes capability, not acceptable risk. A higher class is not automatically permitted, and high-consequence uses may prohibit AI-3 or AI-4.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-AI-REQ-001 | Every material AI use SHALL have a versioned use-case and system-boundary record. | AI system record review |
| GAEP-AI-REQ-002 | Model, provider, adapter, relevant prompt/policy, tools, context sources and evaluation versions SHALL be identifiable to the degree technically possible; missing precision SHALL remain explicit. | Provenance review |
| GAEP-AI-REQ-003 | Evaluation SHALL cover task quality, harmful failure modes, uncertainty, injection/poisoning, data handling, bias or disparate impact where relevant, effect control, cost, latency and fallback. | Evaluation plan/results |
| GAEP-AI-REQ-004 | Evaluation evidence SHALL be scoped to the tested versions, data, context, tools, environment and autonomy; material change SHALL trigger re-evaluation or invalidation. | Drift scenario |
| GAEP-AI-REQ-005 | AI-generated claims, summaries, decisions, reviews and evidence SHALL disclose provenance and SHALL NOT become authoritative solely through generation. | Promotion scenario |
| GAEP-AI-REQ-006 | Human oversight SHALL define information presented, competence, time, authority, challenge, escalation and automation-bias controls; a nominal human click is insufficient. | Oversight review |
| GAEP-AI-REQ-007 | Correlated AI authoring and AI reviewing SHALL be treated as reduced independence unless supported otherwise. | Independence scenario |
| GAEP-AI-REQ-008 | The system SHALL support pause, revocation, safe degradation and a no-AI or manual continuity path for authoritative governance state. | Kill/fallback demonstration |
| GAEP-AI-REQ-009 | Provider data use, retention, human access, residency, deletion, model-improvement use and supplier dependencies SHALL be assessed before approval. | Supplier review |
| GAEP-AI-REQ-010 | AI effects SHALL remain bounded by least authority and exact authorization; persuasive output SHALL NOT expand authority. | Unauthorized-effect scenario |
| GAEP-AI-REQ-011 | User and affected-person transparency SHALL be proportionate to impact, including material AI involvement, limits and challenge channels. | Transparency review |
| GAEP-AI-REQ-012 | Run and model cost, latency, resource use and sustainability constraints SHALL be measurable where material to viability or policy. | Operational/economic review |

## Monitoring and incident response

Monitor material performance, failure patterns, user overrides, unsafe near misses, provider/model changes, context attacks, data leakage, unexplained effect differences and burden. Incidents can invalidate evaluations, adapters, approvals, claims and affected baselines.

## Normative autonomy and operating controls

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-AI-REQ-013 | Every material AI use SHALL be assigned exactly one registered autonomy class from `AI-0` through `AI-4` for the governed scope, and an absent, ambiguous, or unregistered class SHALL block AI-enabled effects. | Autonomy-class validation |
| GAEP-AI-REQ-014 | The autonomy class SHALL bind to exact use case, effect envelope, users, affected persons, environment, model, provider, adapter, tools, context, policy, and human-oversight design; a material change to any binding SHALL invalidate the class determination. | Autonomy-binding scenario |
| GAEP-AI-REQ-015 | Every material AI use SHALL co-select Security Profile `GAEP-PROF-010`, Data Privacy and Records Profile `GAEP-PROF-011`, Legal IP and Supplier Profile `GAEP-PROF-014`, and Workforce Trust Accessibility and Ethics Profile `GAEP-PROF-015` at exact compatible versions; a missing or unresolved mandatory composition SHALL block AI conformance. | Mandatory-composition test |
| GAEP-AI-REQ-016 | `AI-2` SHALL require substantive human validation before authoritative promotion; `AI-3` SHALL require effect-level authorization and applicable validation or Confirmation; `AI-4` SHALL operate only inside an approved policy envelope with continuous constraint enforcement, monitoring, and revocation; effective policy MAY prohibit `AI-3` or `AI-4` for high-consequence use. | Class-boundary scenarios |
| GAEP-AI-REQ-017 | A material or high-consequence AI use SHALL resolve immutable or otherwise exact model, provider, adapter, prompt or policy, tool, context-source, and evaluation identities before reliance; mutable aliases SHALL be resolved to exact identities, and unavailable required identity SHALL block `AI-3`, `AI-4`, and high-consequence reliance. | Exact-identity and alias test |
| GAEP-AI-REQ-018 | AI monitoring SHALL define signals, thresholds, owners, cadence, evidence, escalation, and affected scopes for task performance, harmful failures, disparate impact where relevant, override patterns, unsafe near misses, provider or model change, context attacks, leakage, effect differences, cost, latency, and burden. | Monitoring-contract review |
| GAEP-AI-REQ-019 | A monitoring threshold breach, material drift, provider or model integrity uncertainty, changed operating context, novel attack, harmful incident, or unexplained effect difference SHALL invalidate or reopen affected evaluations, approvals, authorizations, and conformance claims and SHALL pause affected AI-enabled effects until an authorized disposition permits resume. | Drift and pause scenario |
| GAEP-AI-REQ-020 | AI incident response SHALL define detection, incident identity, triage, containment, pause or revocation, evidence custody, notification, affected-person response, correction, recovery, continuity, evaluation and decision reopening, and authorized return-to-service criteria. | AI incident tabletop |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact use-case, model, provider, adapter, prompt or policy, tool, context, evaluation, profile, and policy versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; all mandatory co-profiles use explicit compatible ranges and exact resolved revisions. Missing, incompatible, cyclic, mutable-unresolved, or revoked inputs are non-permissive. |
| Applicability and selection | Select for every material AI capability used by GAEP or governed through GAEP; record purpose, users, affected persons, decisions, effects, environment, selecting principal, exact profile revision, and autonomy class. |
| Co-selection rules | Mandatory: Security Profile (`GAEP-PROF-010`), Data Privacy and Records Profile (`GAEP-PROF-011`), Legal IP and Supplier Profile (`GAEP-PROF-014`), and Workforce Trust Accessibility and Ethics Profile (`GAEP-PROF-015`) for every material AI use. Consequence-triggered: select Assurance for consequential claims or `AI-2` through `AI-4` reliance; Operational Reliability and Incident Response for operational or continuity-critical AI; Audit Integrity when AI decisions or effects require independent reconstruction; and Security-and-Identity Change for identity or privilege effects. |
| Obligations | Use-case governance, exact identity, evaluation, independence, human oversight, authority, effect control, transparency, data and supplier controls, monitoring, incident response, fallback, cost, and retirement obligations compose with all mandatory domain profiles. |
| Permitted variation points | Evaluation methods, thresholds, monitoring cadence, evidence depth, oversight workflow, model choice, and fallback implementation may vary within effective policy and the selected autonomy class. Mandatory composition, exact required identity, least authority, substantive oversight, pause and revocation, incident response, affected-person protections, and no-AI continuity are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the effective configuration identifies AI System Authority, model and use-case owners, domain authorities, eligible approvers, evaluation independence, monitoring owners and cadence, incident authority, and review or retirement triggers. |
| Conformance | Conformance requires an exact manifest, resolved autonomy class, mandatory co-profiles, evaluation and monitoring evidence, requirement and negative-case results, deviations, incidents, drift status, and unresolved obligations. |
| Compatibility and conflicts | Conflict among AI capability, policy, autonomy, exact identity, evaluation, Security, Data, Legal, Workforce, or other selected profiles remains `conflicted`; model output or business benefit cannot resolve it. |
| Invalidation, migration, deprecation, and expiry | Material change to use, effect, autonomy, model, provider, adapter, prompt or policy, tool, context, data, user population, environment, evaluation, monitoring, supplier terms, incident state, or policy reopens the manifest. Evolution preserves use-case, model, evaluation, monitoring, incident, affected-person, migration, retirement, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-AI-REQ-021 | AI-profile selection, autonomy determination, mandatory and triggered co-selection, and every exact-version binding SHALL be explicit and attributable in the effective-configuration manifest. | Composition and binding review |
| GAEP-AI-REQ-022 | Tailoring SHALL use only declared variation points and SHALL NOT weaken mandatory profile composition, exact required identity, evaluation binding, least authority, substantive oversight, pause, revocation, incident response, affected-person protection, or continuity. | AI-tailoring negative test |
| GAEP-AI-REQ-023 | An AI conformance claim SHALL identify the effective manifest, autonomy class, mandatory co-profiles, evidence for every applicable requirement and required negative case, deviations, drift and incident status, and unresolved obligations. | Conformance-record review |
| GAEP-AI-REQ-024 | Material change or profile migration, deprecation, expiry, revocation, or replacement SHALL invalidate affected manifests and SHALL preserve use-case, model, evaluation, monitoring, incident, affected-person, migration, retirement, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- A mutable model or provider alias changes while prior evaluation and authorization remain attached.
- An `AI-2` output becomes authoritative through a nominal click by a person lacking information, competence, time, authority, or practical ability to challenge it.
- An `AI-3` or `AI-4` capability attempts an effect outside its exact authorization or policy envelope.
- Security, Data, Legal, or Workforce Trust is absent or unresolved for a material AI use.
- Drift, provider change, context attack, leakage, harmful incident, or unexplained effect difference occurs without invalidation and pause.
- AI-authored evidence is treated as independent merely because a second correlated model reviewed it.
- Provider loss or revocation makes authoritative governance state unusable because no no-AI or manual continuity path exists.
