---
id: GAEP-REG-001
title: Document Metadata Contract
document_type: registry
schema_version: 1.0
version: 0.2.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP Next candidate documents
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-008
informative_references: []
supersedes: []
---

# Document Metadata Contract

## Required front matter

| Field | Meaning |
|---|---|
| `id` | Stable globally scoped Resource Lineage identifier for the document; it is not an exact revision |
| `title` | Human-readable canonical title |
| `document_type` | Controlled document category |
| `schema_version` | Metadata contract version |
| `version` | Human-facing semantic content version; it does not by itself prove immutable revision identity |
| `status` | Exactly one declared authoring-lifecycle value |
| `owner_role` | Canonical owner-role value registered by GAEP-REG-008; this is semantic stewardship, not a Principal assignment or automatic decision authority |
| `scope` | Effective subject or audience scope |
| `normative_level` | `normative`, `informative`, or `mixed` |
| `classification` | Information-handling classification |
| `provenance` | Origin and transformation description |
| `approval` | Separate approval mapping; never encoded by `status` |
| `normative_dependencies` | Document lineage IDs needed to interpret this document; approved packages additionally pin exact dependency revisions |
| `core_package_interfaces` | **Conditionally required** for a Core module that references later-owned semantics: later-owned interfaces referenced opaquely inside a co-versioned Core package; these edges are visible and jointly resolved but are not claimed to form the interpretation/build DAG |
| `informative_references` | Non-normative supporting sources |
| `supersedes` | Exact document versions replaced by this version |

Metadata schema 1.1 adds the following optional-at-authoring, mandatory-at-exact-binding fields without changing the current candidate validator's 1.0 required-field floor:

| Field | Meaning and activation rule |
|---|---|
| `revision` | Immutable Resource Revision ID. It MAY be `null` while `draft` or `proposed`, but SHALL be exact before approval, baseline designation, conformance, or material evidence binding unless the exact revision is supplied by Candidate Revision Set membership. |
| `content_digest` | Algorithm-qualified digest of canonical document content. It is required when revision identity cannot otherwise resolve immutable content or when a Candidate Revision Set pins the document by digest. |
| `state_dimension` | Declares the one GAEP-CORE-004 dimension represented by `status`; for schema 1.1 document metadata this is `authoring-lifecycle`. |

The file, path, branch, commit, semantic version, and lineage ID are resolution aids or separate version axes; none silently substitutes for an exact Resource Revision.

## Document types

The initial controlled values are:

- `navigation`;
- `product-strategy`;
- `constitution`;
- `principle-catalog`;
- `normative-specification`;
- `profile`;
- `realization`;
- `adapter-profile`;
- `workspace-record`;
- `guide`;
- `scenario-catalog`;
- `roadmap`;
- `registry`;
- `reference`.

## Status values

For metadata schema 1.1, document `status` represents authoring lifecycle only and is distinct from authority, revision disposition, operational eligibility, freshness, validity, approval outcome, baseline designation, and retention:

- `draft`: actively authored and incomplete;
- `proposed`: complete enough for structured review but not approved;
- `in-review`: frozen for an identified Review or Approval Case revision;
- `finalized`: authoring activity is complete for that Resource Revision.

The schema 1.0 values `approved`, `baselined`, `deprecated`, and `retired` are deprecated overloaded aliases. They SHALL migrate respectively to Approval Determination, Baseline Set designation, operational-eligibility `deprecated`, and operational-eligibility `retired`, while preserving authoring lifecycle separately. They are not valid values for new schema 1.1 records.

## Approval mapping

`approval.state: not-approved` is explicit and carries no authority. Any other approval state SHALL be represented by or resolve to an Approval Determination containing:

- exact Approval Determination revision;
- exact subject Resource Revision or Candidate Revision Set revision and membership digest;
- declared approval purpose and scope;
- outcome, conditions, and linked Obligations;
- validity interval and invalidation triggers;
- approving Human Principals, exercised roles, and authority sources;
- determination time and provenance.

A document cannot approve itself through metadata. The mapping is a resolvable projection of the separate governed determination.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-META-REQ-001 | Every candidate normative document SHALL contain all unconditional required front-matter fields and every conditional field applicable to that document; `core_package_interfaces` is required only for a Core module with later-owned semantic edges. | YAML and field validation |
| GAEP-META-REQ-002 | Document IDs SHALL be unique within the authority namespace and SHALL remain reserved after retirement. | Registry uniqueness check |
| GAEP-META-REQ-003 | Approval and Baseline Set designation SHALL be represented by separate exact governed records and SHALL NOT be encoded in document `status`. | Approval-record validation |
| GAEP-META-REQ-004 | A document SHALL NOT claim to supersede another document without identifying the exact superseded version and migration disposition. | Supersession review |
| GAEP-META-REQ-005 | Normative and informative dependencies SHALL be represented separately. | Metadata validation |
| GAEP-META-REQ-006 | Every `owner_role` SHALL resolve to one canonical GAEP-REG-008 entry, while the concrete Principal or Organization assignment remains a separate Role Assignment and may be explicitly unassigned. | Owner-role resolution |
| GAEP-META-REQ-007 | Before approval, baseline designation, conformance, or material evidence binding, each subject document SHALL resolve to an immutable Resource Revision ID or algorithm-qualified content digest. | Exact-revision binding |
| GAEP-META-REQ-008 | An approved package SHALL pin every normative dependency to an exact Resource Revision or declared compatible range resolved to exact revisions in the approved Candidate Revision Set. | Dependency pinning review |
| GAEP-META-REQ-009 | A bare dependency lineage ID MAY be used while a document remains `draft` or `proposed`, but it SHALL NOT support an approval, baseline, conformance, or executable authorization claim without an exact resolution record. | Mutable-dependency negative test |
| GAEP-META-REQ-010 | Document authoring lifecycle, revision disposition, operational eligibility, validity, freshness, approval outcome, baseline designation, and retention SHALL remain orthogonal records or dimensions. | Metadata-state inspection |
| GAEP-META-REQ-011 | Metadata schema 1.0 documents MAY remain proposed during migration, but SHALL satisfy schema 1.1 exact-revision, owner-role, approval, and dependency rules before baseline approval. | Migration-gate review |
| GAEP-META-REQ-012 | `normative_dependencies` SHALL describe the acyclic interpretation/build graph, while every later-owned intra-Core semantic edge SHALL be declared separately in `core_package_interfaces`; GAEP SHALL NOT claim that the complete semantic interface graph is acyclic. | Dual-graph dependency audit |
| GAEP-META-REQ-013 | A document with `core_package_interfaces` SHALL NOT be approved or interpreted as a standalone complete contract; its Approval Case and Candidate Revision Set SHALL pin exact revisions of every declared interface owner. | Co-versioned-package binding test |
| GAEP-META-REQ-014 | An intra-package interface reference SHALL remain an opaque ID or minimal primitive in the earlier contract, and only the owning later contract may define its policy, profile, state, authority, or behavior semantics. | Ownership-boundary review |

## Candidate-baseline rule

All documents created during the pre-implementation restructuring remain `proposed` and `not-approved` until the GAEP-on-GAEP approval gate is completed. Before that gate, the candidate package SHALL be assembled as one exact Candidate Revision Set and proposed through a Baseline Proposal; the resulting Approval Determination and any Baseline Set designation remain separate records. Authorship, semantic version, path, or candidate-set membership does not imply authority.
