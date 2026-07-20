---
id: GAEP-RM-001
title: Pre-Implementation Roadmap
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP product and specification work before implementation authorization
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-SELF-001
informative_references:
  - ../../06_Roadmap/050_PLATFORM_ROADMAP.md
  - 005_PILOT_READINESS_GATE.md
  - 006_CANDIDATE_BASELINE_APPROVAL_GATE.md
  - 007_IMPLEMENTATION_AUTHORIZATION_PROCESS.md
  - 008_COMPLEXITY_AND_SUBTRACTION_GATE.md
supersedes: []
---

# Pre-Implementation Roadmap

## Governing rule

This roadmap ends at implementation authorization. Completion of documentation alone does not authorize implementation.

Every material net-new concept, field, artifact, relationship, profile, gate, workflow, service expectation, or governance role is evaluated under the Complexity and Subtraction Gate (`GAEP-RM-008`) before it becomes candidate baseline scope. A gate result is evidence for a separate scope Decision; it is not the Decision Outcome.

## Stage 0 - Boundary and ownership

Outputs:

- explicit pre-implementation boundary;
- complete gap, contradiction, assumption and decision registers;
- temporary product, specification, risk, assurance and workspace stewardship;
- definition of implementation and external-effect boundaries.

Exit evidence: unresolved foundational work is visible, owned, and cannot silently become an implementation assumption.

## Stage 1 - Product evidence

Outputs:

- Product Charter;
- target segment and anti-segment;
- stakeholder and jobs model;
- problem evidence and theory of change;
- alternatives and positioning assessment;
- selected first workflow and non-goals;
- outcome, burden and economic model;
- distribution, licensing and operating decisions;
- initial complexity budget, subtraction candidates, and displaced-work map.

Exit evidence: one product identity and first workflow are supported by real problem evidence and accountable ownership.

## Stage 2 - Thin Core candidate

Outputs:

- asset/work ontology and cardinalities;
- bounded-context and single-writer ownership map;
- eight active Core contracts covering scope/work/identity/authority; resource/version/trace/provenance; state/event; policy/risk; decision/review/approval/authorization; claim/evidence/assurance; Profile/configuration; and portable extension/compatibility/federation invariants;
- capability/context and execution/effect mechanics classified as Realizations, with extension/supply-chain and federation mechanics extracted to selectable Profiles;
- canonical registries and requirement IDs;
- Complexity and Subtraction Gate Evaluations for material additions to Core.

Exit evidence: the first workflow can be represented without profile-specific concepts leaking into Core.

## Stage 3 - Trust foundation

Outputs:

- platform threat model;
- identity, delegation and approval-integrity assessment;
- data/privacy/records profile;
- AI System and supplier profile;
- assurance case and evidence-quality rules;
- audit-integrity, incident, continuity and degraded-mode rules;
- explicit applicability decisions for the Audit Integrity/Accountability and Incident Response/Continuity profiles when their triggers are met;
- legal, IP and workforce-trust review.

Exit evidence: high-risk and manual/no-AI paths are trustworthy on paper.

## Stage 4 - Profile and scenario validation

Outputs:

- every Profile selected for evaluation by the current applicability manifest, including the candidate Product, corrective-change, migration, security/identity-change, emergency, experiment, reusable-asset, architecture, assurance, platform-security, data/privacy/records, AI System, operational-reliability, legal/IP/supplier, workforce-trust/accessibility/ethics, audit-integrity/accountability, incident-response/continuity, extension/supply-chain, and federation Profiles;
- effective-profile resolution examples;
- complete reference-scenario results;
- corrected Core and profile contracts;
- completed Pilot Readiness Gate Evaluation (`GAEP-RM-005`) and any separate pilot approval and activity authorization required by policy.

Exit evidence: low-risk work is genuinely light; high-risk work remains rigorous; no scenario requires semantic invention; the Pilot Readiness Gate has an acceptable result for the exact pilot package. The gate result does not authorize recruitment, data collection, or pilot operation.

## Stage 5 - Manual pilots

Outputs:

- GAEP-on-GAEP results;
- one Product and one non-Product pilot;
- baseline and comparison measures;
- facilitator-effort accounting;
- user, reviewer, approver and steward feedback;
- repeated-use result;
- value, burden, trust, economics and portability evidence.

Exit evidence: measured value exceeds total burden and participants choose to repeat the workflow.

## Stage 6 - Candidate baseline

Outputs:

- consolidated, non-duplicative candidate corpus;
- acyclic normative dependencies;
- metadata, registry, link and requirement validation;
- standards crosswalks;
- legacy migration and supersession plan;
- final decision and risk dispositions;
- version-pinned approval package.

Exit evidence: the candidate satisfies its own conformance rules and passes the Candidate Baseline Approval Gate (`GAEP-RM-006`). A passing gate still requires a separate Approval Determination before baseline designation.

## Stage 7 - Implementation readiness evaluation and authorization case

Outputs:

- smallest valuable implementation-slice charter;
- scope and explicit exclusions;
- build/buy/compose decision;
- approved quality attributes and threat model;
- acceptance evidence and kill criteria;
- funding, team, support and ownership;
- completed Implementation Readiness Gate Evaluation (`GAEP-RM-003`);
- separate Approval Case and Approval Determination;
- separately scoped Authorization Grants following the Implementation Authorization Process (`GAEP-RM-007`) for any permitted planning, coding, integration, external-data, release, deployment, or production-effect boundary.

Exit result: the Gate Evaluation uses only `not-assessed`, `incomplete`, `failed`, `conditionally-passed`, `passed`, or `blocked`. A passing gate is evidence, not permission. Only a current Authorization Grant covering the exact activity and baseline permits that activity to begin.
