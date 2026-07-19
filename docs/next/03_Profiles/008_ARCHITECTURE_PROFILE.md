---
id: GAEP-PROF-008
title: Architecture Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Architecture Authority
scope: Architecture-significant managed assets and changes
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
  - GAEP-CORE-001
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references:
  - ../../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md
supersedes: []
---

# Architecture Profile

## Selection

Select when a Change materially affects structure, quality attributes, trust boundaries, integration, data, deployment, operations, compatibility, technology constraints or long-lived evolution. Architecture significance is risk- and consequence-based, not determined by document size or organizational title.

## Architecture outcomes

- system context and affected managed assets;
- stakeholder concerns and quality-attribute scenarios;
- constraints, assumptions and unknowns;
- options, trade-offs and rejected alternatives;
- decisions and exact applicability scope;
- logical, information, interaction, deployment, security, operational and evolution views selected as needed;
- interfaces, dependencies and external authorities;
- conformance and fitness criteria;
- migration, compatibility, recovery and retirement consequences.

HLD, LLD, diagrams and technology profiles are possible representations, not universal Core artifacts.

## Quality-attribute scenario

A measurable scenario identifies source, stimulus, affected subject, operating condition, expected response, measure and evidence method. Labels such as `scalable`, `secure`, `maintainable` or `reliable` are insufficient without scoped interpretation.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ARCH-REQ-001 | Architecture-significant concerns SHALL be expressed as scoped decisions, constraints, risks or measurable quality-attribute scenarios. | Architecture review |
| GAEP-ARCH-REQ-002 | Selected views SHALL correspond to stakeholder concerns and Change impact; irrelevant views SHALL NOT be mandatory solely for template completeness. | Applicability review |
| GAEP-ARCH-REQ-003 | A material decision SHALL record considered options, trade-offs, evidence, assumptions, affected scope, consequences and invalidation conditions. | Decision review |
| GAEP-ARCH-REQ-004 | Architecture authority SHALL bind to exact revisions or baselines and SHALL expose unresolved inconsistency with implementation or operation. | Baseline/conformance review |
| GAEP-ARCH-REQ-005 | Architecture conformance SHALL use declared criteria and evidence; visual similarity or document existence alone SHALL NOT establish conformance. | Fitness evidence review |
| GAEP-ARCH-REQ-006 | External systems, interfaces, data assets, logical components, deployable units, workloads and deployment targets SHALL remain distinguishable where relevant. | Topology review |
| GAEP-ARCH-REQ-007 | Known technical debt, temporary architecture, exceptions and deferred decisions SHALL create owned obligations or accepted risks. | Obligation review |
| GAEP-ARCH-REQ-008 | Evolution, compatibility, migration, recovery and retirement consequences SHALL be considered proportionately before approval. | Lifecycle scenario |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, decision, view, baseline, policy, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, or cyclic inputs prevent an architecture conformance claim. |
| Applicability and selection | Select when a Change materially affects structure, quality attributes, trust, integration, information, deployment, operation, compatibility, constraints, or long-lived evolution; bind selection to affected assets and concerns. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security for trust and security concerns; Data for information, privacy, or records concerns; AI for AI system or autonomy concerns; Operational Reliability for live operational concerns; Legal for suppliers, distribution, jurisdiction, or regulatory constraints; Workforce Trust for accessibility or human-system effects; Migration for material transition; Assurance for consequential architecture claims; Audit Integrity for material accountability and reconstruction concerns; and Incident Response for detection, communication, recovery, continuity, or incident-command concerns. |
| Obligations | Architecture outcomes, selected views, decisions, quality scenarios, conformance criteria, and lifecycle consequences compose with domain-profile obligations; architecture review does not replace them. |
| Permitted variation points | View set, notation, artifact representation, evidence method, review independence, and review cadence may vary by concern and consequence. Exact decision scope, measurable criteria, conflict visibility, and lifecycle consequences are not variation points. |
| Authority, evidence, and cadence | Architecture Authority owns the profile; the effective configuration identifies decision and approval authorities, stakeholder evidence, fitness methods, independence, and review cadence. |
| Conformance | Conformance requires an exact manifest, concern-to-view rationale, decision and fitness evidence, requirement and negative-case results, deviations, and unresolved inconsistencies. |
| Compatibility and conflicts | Inconsistent architecture, implementation, operation, policy, or domain-profile requirements remain explicit and resolve to `conflicted` when jointly unsatisfied. |
| Invalidation, migration, deprecation, and expiry | Material change to concern, constraint, assumption, decision, baseline, dependency, topology, interface, data, environment, evidence, or policy reopens conformance. Profile evolution preserves decision, view, criterion, migration, deprecation, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ARCH-REQ-009 | Architecture-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible versions, affected assets, and stakeholder concerns. | Composition review |
| GAEP-ARCH-REQ-010 | Tailoring SHALL use only declared variation points and SHALL NOT weaken exact decision scope, measurable criteria, conflict visibility, domain obligations, or lifecycle consequences. | View-tailoring negative test |
| GAEP-ARCH-REQ-011 | A conformance claim SHALL identify the effective manifest, concern and view rationale, evidence for every applicable requirement and required negative case, deviations, and unresolved inconsistencies. | Conformance-record review |
| GAEP-ARCH-REQ-012 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve decision, view, criterion, compatibility, migration, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- A diagram or document is treated as conformance without measurable criteria or evidence.
- An architecture-significant security, data, AI, operational, legal, or workforce concern omits its domain profile.
- A decision remains approved after a material constraint, baseline, or dependency changes.
- A selected view hides a known conflict between architecture and implementation or operation.
- A technology or notation default silently becomes an architecture requirement.
