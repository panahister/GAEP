---
id: GAEP-REG-003
title: Reference Entry Contract
document_type: registry
schema_version: 1.0
version: 0.2.0
status: proposed
owner_role: GAEP Reference Steward
scope: External references used by GAEP specifications, profiles, decisions, and evidence
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
informative_references:
  - ../../99_References/990_REFERENCES.md
supersedes: []
---

# Reference Entry Contract

## Required reference fields

- stable local reference ID;
- title;
- author, publisher or governing body;
- publication and exact edition/version/revision, or explicit `unresolved` plus resolution owner, closure condition, and prohibition on material reliance;
- publication date and status;
- canonical locator;
- date accessed and date last reviewed, including explicit `not-accessed` or `not-reviewed` values;
- assessor identity, accountable owner role, and authority/provenance assessment;
- intended GAEP use;
- normative or informative relationship plus exact GAEP source/target relationship mapping and mapping rationale;
- applicable scope;
- rights/licensing status, source terms, copyright and quotation constraints;
- known supersession, instability or access risks;
- owner and next review condition.

No external reference or mapping establishes GAEP or external-standard conformance by inference. A conformance claim requires a separately approved, version-bound mapping and evidence case against the actual criteria.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REF-REQ-001 | A reference used to support a normative or assurance claim SHALL identify an exact version or SHALL expose version uncertainty. | Reference review |
| GAEP-REF-REQ-002 | A reference SHALL identify its intended use and SHALL NOT become normative merely by appearing in a bibliography. | Dependency review |
| GAEP-REF-REQ-003 | Proprietary or copyrighted material SHALL be summarized, quoted and stored only within applicable rights. | Rights review |
| GAEP-REF-REQ-004 | A superseded, withdrawn, unavailable or materially changed reference SHALL trigger review of dependent claims and mappings. | Change scenario |
| GAEP-REF-REQ-005 | External standards mappings SHALL identify relationship type, assessor, rationale, source/target versions and review date. | Crosswalk review |
| GAEP-REF-REQ-006 | A reference without an exact edition, version, or revision SHALL use the controlled state `unresolved` and SHALL identify resolution owner, closure evidence, and the claims or gates blocked from relying on it. | Version-uncertainty gate |
| GAEP-REF-REQ-007 | Every reference SHALL record access date and review date separately, or explicit `not-accessed` and `not-reviewed` values with reason. | Date-field validation |
| GAEP-REF-REQ-008 | Every mapping SHALL identify assessor Principal or explicit unassigned assessor role, accountable owner role, exact GAEP source and target versions, registered relationship type, rationale, limitations, and next review trigger. | Mapping-record validation |
| GAEP-REF-REQ-009 | Every reference SHALL expose rights/licensing status as `confirmed-permitted`, `link-and-summary-only`, `permission-required`, `unresolved`, or another registered extension value before content is stored, quoted, transformed, or distributed. | Rights-state review |
| GAEP-REF-REQ-010 | Citation, similarity, relationship mapping, or use as calibration evidence SHALL NOT imply GAEP conformance, certification, endorsement, equivalence, or conformance to the external source. | Conformance-inference negative test |
| GAEP-REF-REQ-011 | A crosswalk used by an approval or release gate SHALL contain no unresolved source version, assessor, mapping, review-date, or rights field for any relied-upon row. | Release-crosswalk completeness test |
