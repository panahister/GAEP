---
id: GAEP-SELF-009
title: GAEP Stakeholder and Role Assignment
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP product, specification, pilot, and future implementation governance
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-002
informative_references: []
supersedes: []
---

# GAEP Stakeholder and Role Assignment

## Candidate canonical role system

This is a role-type catalog, not an Authority Assignment. Every current assignment is unresolved. Authorship, repository ownership, file metadata, or tool access does not assign a role or create authority.

| Role | Accountability | Current assignment |
|---|---|---|
| GAEP Investment Sponsor | continued investment, strategic risk, organizational mandate and funding | unassigned |
| GAEP Product Owner | target user, problem evidence, first workflow, value and scope | unassigned |
| GAEP Product Research Owner | research ethics, problem evidence, pilot design and evidence limitations | unassigned |
| GAEP Constitutional Owner | constitutional interpretation, approval and amendment authority | unassigned |
| GAEP Decision and Authorization Steward | separation and integrity of decisions, approvals, grants and effect boundaries | unassigned |
| GAEP Distribution and Ecosystem Owner | distribution mode, contribution, conformance marks and ecosystem boundary | unassigned |
| GAEP Specification Steward | corpus integrity, terminology, requirements, compatibility and baseline coordination | unassigned; an acting author is not an Authority Assignment |
| GAEP Core Subject Owner | one bounded Core semantic subject and compatibility obligations | unassigned by subject |
| GAEP Profile Specification Steward | one Profile's semantic applicability rules, obligations, evidence contract, conformance and evolution | unassigned by profile; selection authority remains separate |
| GAEP Conformance Authority | declared conformance evaluation and result | unassigned |
| GAEP Identity and Authority Steward | role taxonomy, assignments, delegation and accountable-human chains | unassigned |
| GAEP Assurance Authority | critical claims, evidence rules, assurance evaluation and gate method | unassigned |
| GAEP Audit Authority | scoped audit coverage, integrity, reconstruction, correction and independent challenge | unassigned |
| GAEP Risk Owner | risk-register integrity, assessment method, treatment tracking and review | unassigned |
| GAEP Security Authority | threat model, security controls and security Risk Acceptance within assigned scope | unassigned |
| GAEP Data, Privacy, and Records Authority | data purpose, privacy, classification, retention, deletion, legal hold and records | unassigned |
| GAEP AI System Authority | use case, autonomy, evaluation, provider, human oversight and drift | unassigned |
| GAEP Operational Authority | support, incidents, continuity, recovery, cost and retirement | unassigned |
| GAEP Incident and Continuity Authority | material incident declaration, evidence custody, coordinated response, communication, continuity, recovery, closure and reopening | unassigned |
| GAEP Legal, IP, and Supplier Authority | ownership, distribution, licensing, contracts, supplier and jurisdiction obligations | unassigned |
| GAEP Organizational Trust Authority | workforce trust, accessibility, affected-person protection, ethics and appeal boundaries | unassigned |
| GAEP Adoption Owner | workflow substitution, training, support, trust and expansion | unassigned |
| GAEP Workspace Steward | repositories, external mappings, freshness, validation and portability | unassigned |
| GAEP Metric Integrity Owner | metric definitions, data quality, anti-gaming, privacy and independent reporting | unassigned |
| GAEP Initiative Owner | local Initiative outcome, applicability and affected-participant obligations | unassigned |
| GAEP Pilot Facilitator | executes a manual pilot without hiding facilitation cost | unassigned |
| GAEP Independent Reviewer | tests assumptions, harms, alternatives and evidence within declared competence | unassigned |

## Existing profile-role label crosswalk

Profile metadata now names `GAEP Profile Specification Steward` for semantic stewardship. The applicability contracts separately use domain-role labels for selection, approval, assessment, or operational decisions. The mappings below expose proposed GAEP-specific operating aliases for those domain roles. They remain recommendations under `GAEP-DEC-018`, not silent renames, Principal assignments, or authority grants.

| Existing profile label | Candidate canonical role | Current disposition |
|---|---|---|
| Product Governance Authority | GAEP Product Owner plus scoped local governance authority | mapping unresolved |
| Engineering Change Authority | GAEP Initiative Owner plus scoped engineering authority | mapping unresolved |
| Migration Authority | GAEP Initiative Owner plus scoped migration authority | mapping unresolved |
| Security Authority | GAEP Security Authority | mapping unresolved |
| Operational Authority | GAEP Operational Authority | mapping unresolved |
| Experiment Authority | GAEP Product Research Owner plus scoped experiment authority | mapping unresolved |
| Capability Steward | GAEP Profile Specification Steward consultation; a separate selection authority is required | mapping unresolved |
| Architecture Authority | GAEP Initiative Owner plus scoped architecture authority | mapping unresolved |
| Assurance Authority | GAEP Assurance Authority | mapping unresolved |
| Data and Privacy Authority | GAEP Data, Privacy, and Records Authority | mapping unresolved |
| AI System Authority | GAEP AI System Authority | mapping unresolved |
| Legal and Supplier Authority | GAEP Legal, IP, and Supplier Authority | mapping unresolved |
| Organizational Trust Authority | GAEP Organizational Trust Authority | mapping unresolved |
| Audit Authority | GAEP Audit Authority | mapping unresolved |
| Incident and Continuity Authority | GAEP Incident and Continuity Authority | mapping unresolved |

## Candidate user system

- sponsor: CTO, VP Engineering or Head of Platform hypothesis;
- adoption owner: platform or architecture lead hypothesis;
- primary operator: technical lead or architect preparing a material change hypothesis;
- participant: engineer using AI assistance hypothesis;
- reviewer: product, architecture, security, quality or operations according to risk;
- steward: repository/platform maintainer;
- beneficiaries: delivery teams, operators, affected users and later assessors.

These are hypotheses, not validated personas or assignments.

## Role naming rule

Role type, accountable identity, authority source, assignment scope, valid time, delegation and acting role are separate. Within this candidate workspace the canonical types use the `GAEP` prefix to avoid ambiguous aliases. A consumer organization may bind its own role labels only through an approved mapping. Near-synonyms are not silently equivalent; the candidate role registry must map or retire them before baseline approval.

## Separation of governance layers

Governance **of GAEP** decides product scope, Core meaning, profile releases, security, operations and distribution. Governance **through GAEP** applies approved semantics to consumer initiatives. The same person may hold multiple roles, but the acting role, authority source and conflict of interest remain explicit.

## Immediate blocker

No candidate baseline or implementation readiness decision can be approved until the required authorities are assigned or an approved role-composition profile identifies who legitimately combines them.
