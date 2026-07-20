---
id: GAEP-RM-006
title: Candidate Baseline Approval Gate
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Assurance Authority
scope: Readiness evaluation and approval-case inputs for a named GAEP specification baseline
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-003
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-STR-007
  - GAEP-STR-008
  - GAEP-RM-008
informative_references:
  - ../06_GAEP_On_GAEP/003_DECISION_REGISTER.md
  - ../06_GAEP_On_GAEP/004_RISK_REGISTER.md
  - ../06_GAEP_On_GAEP/005_ASSURANCE_CASE.md
  - 004_LEGACY_MIGRATION_MAP.md
supersedes: []
---

# Candidate Baseline Approval Gate

## Purpose

This gate evaluates whether one exact Candidate Revision Set revision is ready to support a Baseline Proposal and enter a formal Approval Case. If the proposal is approved, a separate authorized designation may create a Baseline Set. A passing gate is not a Baseline Proposal, Approval Determination, Authorization Grant, or Baseline Set and does not supersede legacy documents by itself.

## Requirements

| Requirement ID | Required condition | Evidence |
|---|---|---|
| GAEP-BASE-READY-REQ-001 | The Candidate Revision Set SHALL enumerate exact document and registry revisions or immutable content digests and SHALL have one exact immutable set revision. | Candidate Revision Set manifest |
| GAEP-BASE-READY-REQ-002 | Product identity, first workflow, scope, non-goals, operating ownership, distribution, license and contribution decisions SHALL have explicit outcomes or approved blockers. | Product decision package |
| GAEP-BASE-READY-REQ-003 | Every document SHALL have valid metadata, owner, normative level, dependencies, approval state and migration disposition. | Structural validation |
| GAEP-BASE-READY-REQ-004 | Document IDs, requirement IDs, registry values and normative dependency graphs SHALL be unique, valid and acyclic. | Conformance report |
| GAEP-BASE-READY-REQ-005 | Core concept ownership, state dimensions, profile resolution, policy resolution, identity, approval, authorization, evidence and effect semantics SHALL be consistent across the set. | Semantic integration review |
| GAEP-BASE-READY-REQ-006 | Authorized paper scenarios, reversible migration rehearsals, GAEP-on-GAEP manual rehearsals, and any separately authorized participant pilots SHALL identify unresolved ambiguity, burden, negative evidence, invented workarounds, and specification corrections without representing a rehearsal as a pilot. | Scenario and rehearsal evidence |
| GAEP-BASE-READY-REQ-007 | AI-assisted authorship, source provenance, external references, copyright, third-party rights and evidence limitations SHALL be disclosed. | Provenance and IP review |
| GAEP-BASE-READY-REQ-008 | Security, privacy, records, AI, audit, supplier, operational, workforce-trust and accessibility reviews SHALL cover the candidate's intended use. | Domain review package |
| GAEP-BASE-READY-REQ-009 | Open decisions, dissent, accepted risks, exceptions and unsupported claims SHALL remain visible and have owners and review conditions. | Decision/risk review |
| GAEP-BASE-READY-REQ-010 | The legacy migration map SHALL identify exact supersession, breaking-semantic Decision Records, compatibility, identity and state transformation, consumer impact, redirect, archival, rollback, historical-interpretation, and recovery treatment. | Clause- and record-level migration plan |
| GAEP-BASE-READY-REQ-011 | Independent reviewers SHALL be able to interpret the candidate without relying on hidden model reasoning or unrecorded author explanation. | Independent review evidence |
| GAEP-BASE-READY-REQ-012 | The candidate SHALL pass its declared structural and semantic conformance checks. | Validation evidence |
| GAEP-BASE-READY-REQ-013 | Every material net-new candidate concept, field, artifact, relationship, profile, gate, workflow, role, or service expectation SHALL have a current Complexity and Subtraction Gate Evaluation and a separate scope Decision. | Complexity evaluations and Decision Records |
| GAEP-BASE-READY-REQ-014 | The exact Candidate Revision Set SHALL have an assigned and effective proposer, a separately assigned eligible approver with a current scoped standing Authority Grant, disclosed role concentration and conflicts, and the independent review required by the Approval Case; absence of any required authority SHALL block the gate. | Authority-resolution and segregation review |
| GAEP-BASE-READY-REQ-015 | Candidate Revision Set assembly SHALL deterministically enumerate the declared inclusion and exclusion scope, exact member paths, immutable content digests, byte counts, repository storage revision, clean-worktree condition, aggregate membership digest, purpose, owner role, and non-authority declarations. | Manifest reproduction test |
| GAEP-BASE-READY-REQ-016 | A dirty working-tree snapshot MAY support draft inspection only when it is explicitly labeled `draft-working-tree-snapshot`; it SHALL NOT be designated or proposed as a Candidate Revision Set. | Dirty-tree negative test |
| GAEP-BASE-READY-REQ-017 | Formal manifest assembly SHALL fail closed when the worktree is dirty, required identity or purpose is absent, a member is missing, or a recorded digest or byte count differs from the exact subject. | Formal-assembly failure tests |
| GAEP-BASE-READY-REQ-018 | Manifest generation, candidate validation, a clean Git commit, or an aggregate digest SHALL NOT create a Baseline Proposal, Approval Determination, Baseline Set, conformance claim, Authority Grant, Authorization Grant, or implementation permission. | Authority-inference negative test |

## Assembly and validation mechanics

`scripts/build_candidate_revision_set.rb` emits a deterministic JSON manifest to standard output. Its default mode requires a clean worktree. `--allow-dirty-draft` deliberately changes the designation to `draft-working-tree-snapshot`; `--formal` requires a clean worktree and an explicit `--candidate-set-id`, and still emits `approval_state: not-approved` plus `authority_effect`, `baseline_effect`, and `implementation_effect` as `none`. Changing one included byte or member path changes the derived set revision.

`scripts/validate_next_docs.rb` provides four cumulative modes: `structural`, `candidate`, `baseline`, and `implementation-readiness`. The first two report contract-integrity failures as `FAIL`. The gate modes separately report absent decisions, evidence, authority, or downstream prerequisites as `BLOCKED` and use exit status 2, so automation cannot confuse an expected governance stop with a malformed corpus. `--manifest PATH` verifies member coverage, paths, byte counts, content digests, membership digest, and set revision against the current repository.

These scripts implement assembly and evaluation mechanics only. They do not sign, submit, approve, designate, publish, or authorize any record, and this repository currently contains no formal manifest.

## Evaluation, approval, and designation

The Gate Evaluation produces the Core gate result. If the result is `passed` or `conditionally-passed`, the designated proposer may create a Baseline Proposal that references the exact Candidate Revision Set revision, proposed authority scope, purpose, release, environment, and validity. The designated authorities may then consider a separate Approval Case for that proposal. Only an approved Approval Determination and valid Authorization Grant may create the Baseline Set designation or supersede a prior set.
