---
id: GAEP-CST-003
title: Normative Language and Conformance
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP specifications, profiles, realizations, and conformance claims
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references: []
supersedes: []
---

# Normative Language and Conformance

## Purpose

This document defines how GAEP requirements are written, specialized, verified, and claimed. It prevents guidance, examples, vendor behavior, and organizational preference from silently becoming universal GAEP requirements.

## Requirement language

- `SHALL` and `MUST` identify mandatory requirements.
- `SHALL NOT` and `MUST NOT` identify mandatory prohibitions.
- `SHOULD` identifies a recommended requirement whose deviation requires recorded rationale.
- `MAY` identifies a permitted option.
- Descriptive text without these terms is informative unless a requirement table explicitly says otherwise.

The uppercase terms above are keywords only when used inside an addressable requirement or an explicitly normative table.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-CONF-REQ-001 | Every normative requirement SHALL have a stable, unique requirement ID. | Registry uniqueness check |
| GAEP-CONF-REQ-002 | Every normative document SHALL identify its owner role, version, status, scope, normative dependencies, and approval state. | Metadata validation |
| GAEP-CONF-REQ-003 | A conformance claim SHALL identify the exact GAEP Core version, selected profile versions, organizational bindings, implementation or workspace version, known deviations, and supporting evidence. | Conformance-record review |
| GAEP-CONF-REQ-004 | A profile SHALL NOT weaken a Core prohibition or mandatory invariant unless the Core requirement explicitly declares a permitted variation point. | Effective-profile review |
| GAEP-CONF-REQ-005 | Organizational configuration SHALL NOT silently override approved policy or profile obligations. | Resolution-scenario test |
| GAEP-CONF-REQ-006 | Normative dependencies SHALL form an acyclic graph. Informative references MAY be cyclic. | Dependency graph validation |
| GAEP-CONF-REQ-007 | Examples and vendor-specific guidance SHALL be labeled informative and SHALL NOT create requirements absent from a normative contract. | Editorial and conformance review |
| GAEP-CONF-REQ-008 | An approval or conformance result SHALL bind to exact subject revisions or content digests and SHALL become stale or invalid when its declared invalidation conditions occur. | Revision-change scenario |
| GAEP-CONF-REQ-009 | Unknown, conflicting, unavailable, or invalid configuration SHALL resolve to an explicit result; it SHALL NOT be interpreted as silent permission. | Negative scenario test |
| GAEP-CONF-REQ-010 | Every declared deviation SHALL identify rationale, accountable owner, affected scope, risk, expiry or review condition, and compensating controls when applicable. | Deviation-record review |

## Conformance classes

GAEP defines separate claims rather than one vague `GAEP compliant` label:

- **Core semantic conformance:** the subject preserves Core meaning and invariants.
- **Profile conformance:** the subject satisfies a named profile and its effective bindings.
- **Workspace conformance:** governed resources, references, metadata, approvals, and evidence are represented portably.
- **Runtime conformance:** orchestration preserves authorization, state, evidence, recovery, and effect semantics.
- **Adapter conformance:** an adapter declares capabilities and translates without silently changing GAEP meaning.
- **Organizational conformance:** an organization has approved bindings, authorities, ownership, and operating controls.

Claims may be partial only where the relevant specification declares a partial conformance class. Partial support must identify unsupported requirements and consequences.

## Requirement ownership and verification

Each requirement belongs to one normative document. Other documents reference its ID rather than restating it with altered language. Verification may be inspection, analysis, scenario review, demonstration, test, attestation, or operational evidence. The required method must be proportionate to risk and named by the owning requirement or selected profile.

## Change control

A normative change must identify affected requirement IDs, registries, profiles, examples, conformance claims, migrations, and approvals. Renumbering a requirement solely for editorial convenience is prohibited; retired IDs remain reserved.

