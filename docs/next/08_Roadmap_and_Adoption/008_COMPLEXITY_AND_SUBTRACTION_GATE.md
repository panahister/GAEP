---
id: GAEP-RM-008
title: Complexity and Subtraction Gate
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: Evaluation of material net-new GAEP structure and the work it replaces, defers, or removes
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-007
  - GAEP-STR-005
  - GAEP-STR-006
informative_references:
  - ../06_GAEP_On_GAEP/010_VALUE_BURDEN_AND_TRUST_SCORECARD.md
supersedes: []
---

# Complexity and Subtraction Gate

## Purpose

This gate evaluates whether a material addition to GAEP earns its semantic, cognitive, operational, adoption, compatibility, and maintenance cost. It applies to a net-new concept, field, artifact, relationship, profile, gate, workflow step, role, registry value, service expectation, realization contract, or adapter obligation.

Passing this gate does not select the addition, approve a baseline, authorize implementation, or make a deferred capability roadmap scope. A separate Decision Record selects add, simplify, compose, defer, replace, or remove.

## Required evaluation

| Requirement ID | Required condition | Evidence |
|---|---|---|
| GAEP-COMPLEX-REQ-001 | The proposal SHALL identify the validated user job, constitutional requirement, conformance defect, risk treatment, or bounded experiment that requires the addition. | Need and trace review |
| GAEP-COMPLEX-REQ-002 | The proposal SHALL identify the existing activity, artifact, concept, handoff, re-explanation, control, or external capability it replaces, simplifies, or deliberately leaves in place. | Displaced-work map |
| GAEP-COMPLEX-REQ-003 | The proposal SHALL compare at least the smallest coherent option, composition with an existing capability, deferral, and no-action or removal. | Alternatives record |
| GAEP-COMPLEX-REQ-004 | The proposal SHALL quantify or bound author, reviewer, approver, steward, support, migration, training, integration, and affected-participant burden, or provide a time-bounded method to establish those values. | Burden contract |
| GAEP-COMPLEX-REQ-005 | The proposal SHALL identify its semantic owner, operating owner, decision authority, expected lifetime, support cost, change frequency, and retirement path; unassigned authority SHALL remain an explicit blocker. | Ownership and lifecycle review |
| GAEP-COMPLEX-REQ-006 | A proposed Core addition SHALL demonstrate why stable cross-profile meaning is necessary and why a Profile, Workspace, Realization, Adapter, guide, or external authority is insufficient. | Layer-placement analysis |
| GAEP-COMPLEX-REQ-007 | The proposal SHALL identify compatibility, migration, federation, accessibility, security, privacy, workforce-trust, and exit consequences where applicable. | Impact and exit analysis |
| GAEP-COMPLEX-REQ-008 | The proposal SHALL define falsification, removal, simplification, or consolidation triggers and the evidence review cadence. | Subtraction rule |
| GAEP-COMPLEX-REQ-009 | The proposal SHALL expose duplicated semantics, parallel records, hidden facilitation, and any burden transferred between roles or systems. | Duplication and burden audit |
| GAEP-COMPLEX-REQ-010 | The proposal SHALL identify the smallest scenario or pilot evidence needed before broader inclusion and SHALL NOT use future extensibility alone as justification. | Evidence plan |
| GAEP-COMPLEX-REQ-011 | The gate SHALL fail or remain incomplete when a mandatory addition has no accountable owner, no measurable purpose, no subtraction analysis, or no safe exit. | Negative gate scenarios |
| GAEP-COMPLEX-REQ-012 | The resulting scope Decision SHALL reference the Gate Evaluation and preserve rejected simpler options, dissent, conditions, and review triggers. | Decision-record inspection |

## Gate result

The Gate Evaluation records exactly one Core result: `not-assessed`, `incomplete`, `failed`, `conditionally-passed`, `passed`, or `blocked`. Conditions become explicit Obligations in any dependent decision or approval; they are not hidden inside a score.

## Current profile-contract subtraction finding

A 2026-07-20 candidate-mode recount provides a concrete complexity signal while preserving the earlier comparison:

- the original 15 Profiles contained 121 requirements before the repair pass;
- the current versions of those same 15 Profiles contain 194 requirements, an increase of 73 or 60.3%;
- Audit Integrity/Accountability and Incident Response/Continuity add 32 requirements;
- Extension/Supply-Chain and Federation add 18 requirements;
- all 19 candidate Profiles therefore contain 244 requirements;
- 76 requirements are repeated structural contract rows: four common rows across each of 19 Profiles.

**Recommendation `GAEP-REC-SUB-001`:** evaluate a shared, machine-validated Profile Contract schema owned by `GAEP-CORE-009` for the repeated structural invariants, while each Profile retains its field values, applicability rules, domain obligations, prohibitions, evidence, and domain-specific deltas. This recommendation is tied to unresolved `GAEP-DEC-005` and `GAEP-DEC-016`; it is not a Core change, scope Decision, or completed Complexity and Subtraction Gate Evaluation. Counts must be regenerated when Profile requirements change.

## Current state

No Complexity and Subtraction Gate Evaluation exists. Current candidate structures remain proposals and require evaluation before candidate baseline approval.
