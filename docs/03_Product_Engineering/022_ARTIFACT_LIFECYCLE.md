# Artifact Lifecycle

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PEN-022  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Governed artifact lifecycle

## Purpose

This document defines how GAEP artifacts are proposed, authored, reviewed, approved, baselined, changed, superseded, and retired.

## Artifact Definition

An artifact is a governed, identifiable unit of durable product or engineering knowledge. It may be narrative, structured data, a model, design, backlog item, decision, contract, code asset, test, result, release record, or operational evidence.

An output becomes a governed artifact only when it has required identity, metadata, provenance, owner, state, and lifecycle disposition.

## Artifact Classes

- foundation and policy;
- product and business knowledge;
- architecture and design;
- process, data, rule, and event models;
- UX and design-system assets;
- backlog and acceptance;
- implementation and contracts;
- validation and evidence;
- decision, approval, risk, and exception;
- release and operational;
- reusable command, skill, template, pattern, and boilerplate;
- external reference.

## Mandatory Artifact Properties

Every material artifact has:

- stable artifact ID;
- type and schema version;
- title and summary;
- Engineering Initiative, implementation-unit, Product where applicable, or organizational scope;
- owner and contributors;
- version and lifecycle state;
- authority class;
- creation and modification provenance;
- source and trace relationships;
- classification and access constraints;
- review and approval requirements;
- supersession and retention information;
- validation results where applicable.

## Lifecycle States

### Proposed

The need and intended outcome are identified. The artifact may not yet exist.

Required: proposer, purpose, target type, scope, and expected owner.

### Draft

The artifact is being authored. It is provisional and cannot govern downstream work unless an explicit policy allows draft use.

Required: version, owner, sources, assumptions, and visible draft status.

### Challenged

Material assumptions, completeness, alternatives, evidence, or fitness are under Human–AI or specialist challenge. Findings and unresolved questions remain traceable.

### Revised

The artifact changed in response to challenge, review, impact analysis, or new evidence and awaits the next governed disposition.

### In Review

The artifact is stable enough for evaluation against defined criteria.

Required: review scope, reviewers, baseline references, criteria, and open findings.

### Awaiting Approval

Required review and challenge are complete enough for an accountable decision. Open conditions, accepted findings, evidence, and the exact proposed version are visible to the approver.

### Approved

An accountable approver has accepted the artifact for a stated scope, version, and conditions.

Required: approval record, resolved or accepted findings, and conditions.

### Rejected

The exact proposed version was not accepted. Rationale and any resubmission conditions remain in history.

### Baseline

The approved version is designated as the current authoritative source for downstream work.

Required: effective version, date, scope, trace index, and change-control policy.

### Superseded

A newer baseline replaces the artifact. The older version remains available for history and historical trace.

Required: `superseded_by` link and effective transition.

### Retired

The artifact no longer participates in active work but is retained or disposed according to policy.

Required: reason, retention decision, and impact closure.

### Exceptional States

- `rejected` — evaluated and not accepted;
- `withdrawn` — removed by proposer before approval;
- `invalidated` — known event makes the artifact unreliable;
- `stale` — an applicable source or decision changed and the artifact no longer reflects current approved state;
- **Regeneration Required** (`regeneration_required`) — impact analysis requires a revised version before the next applicable gate;
- `archived` — retained outside active navigation without implying retirement semantics.

## Applicability and Reuse State

Lifecycle state shall not be overloaded with applicability. A separate Applicability Decision may classify an artifact as **Required**, **Recommended**, **Optional**, **Not Applicable**, **Deferred**, **Conditionally Required**, **Already Satisfied**, **Reused**, **Blocked**, or **Awaiting Human Decision**.

An existing artifact may be classified as Already Satisfied or Reused only after authority, version, compatibility, freshness, scope, and approval are verified. Existing is an observed condition, not a separate applicability state. A Not Applicable result requires rationale when absence could affect governance or traceability. Deferred and conditional results identify owner, trigger, and consequence.

Architecture Assets, HLD, LLD, Assurance Profiles, Test Cases, and Test Evidence also carry freshness, automation, or execution dimensions defined by the [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Creation Flow

1. Determine whether an existing artifact can be reused or changed.
2. Define purpose, type, owner, scope, and required authority.
3. Instantiate the approved schema or template.
4. Load required context and upstream trace sources.
5. Create the draft with provenance and assumptions.
6. Validate structure and required metadata.
7. Create or update semantic trace links.
8. Submit for review with explicit criteria.

## Review Flow

Review may include:

- substantive domain review;
- architecture and consistency review;
- security, privacy, legal, and compliance review;
- usability and accessibility review;
- trace and metadata validation;
- independent AI analysis;
- deterministic schema or quality checks.

Findings include severity, location, rationale, owner, due state, and disposition. AI findings do not become human decisions automatically.

## Approval and Baseline

Approval records:

- artifact ID and exact version;
- decision and scope;
- approver identity and role;
- time and effective date;
- evidence reviewed;
- accepted risks or conditions;
- expiration or review trigger.

Baselining additionally establishes the version as authoritative for downstream use. Approval and baseline may occur together but remain conceptually distinct.

## Change After Baseline

Baselines are changed through [Change Management](023_CHANGE_MANAGEMENT.md):

1. create a change request;
2. branch or derive a new artifact version;
3. analyze affected trace relationships;
4. review the change and downstream impacts;
5. approve the analyzed scope;
6. validate the new version;
7. baseline the new version;
8. supersede the old version;
9. update affected artifacts and evidence.

Silent in-place meaning changes are prohibited.

## Artifact Sets

Some gates approve a coherent set rather than isolated artifacts. An artifact set has:

- set ID and purpose;
- member artifact IDs and exact versions;
- consistency rules;
- set-level review and approval;
- resulting baseline or lifecycle transition.

Member changes invalidate or reopen set approval according to policy.

## Generated Artifacts

AI-generated artifacts must declare:

- generating run, command, skill, model/adapter, and context-pack IDs;
- human owner;
- generated or assisted provenance;
- validation performed;
- current provisional state.

Generated content is never approved by origin. It follows the same lifecycle as human-authored content.

## External Artifacts

Artifacts hosted in Figma, backlog systems, document platforms, or other repositories need:

- stable external reference;
- provider and object identity;
- captured version or snapshot semantics;
- owner and authority;
- access and retention policy;
- repository metadata and trace links;
- behavior when the external item changes or becomes unavailable.

## Validation Rules

An artifact cannot enter review when:

- required metadata is missing;
- sources or assumptions are concealed;
- the target type or template is invalid;
- mandatory trace links are absent without waiver;
- an unresolved conflict makes review misleading.

An artifact cannot become baseline when:

- approval is missing, expired, or for another version;
- blocking findings remain;
- required evidence is not accepted;
- its authoritative predecessor relationship is ambiguous;
- the state transition is unauthorized.

## Ownership Transfer

Artifact ownership changes require:

- outgoing or governance acknowledgment;
- incoming owner acceptance;
- open findings, risks, review dates, and obligations transfer;
- metadata and notification update.

Orphaned baseline artifacts are a governance defect.

## Retention and Disposal

Retention considers:

- constitutional and audit history;
- legal, regulatory, and contractual obligations;
- product support and incident needs;
- reusable learning;
- security and privacy minimization;
- storage cost.

Deletion must not break required evidence or trace history. Sensitive temporary context may have shorter retention than approved decision records.

## Artifact Health Metrics

- percentage with valid owner, state, version, and provenance;
- required trace coverage;
- review freshness;
- stale or invalidated baseline count;
- orphaned and duplicated artifacts;
- unresolved blocking findings;
- supersession correctness;
- external-link availability;
- average time from draft to baseline.

## Design Implications

This lifecycle directly governs:

- [Artifact Model](../04_Repository/033_ARTIFACT_MODEL.md)
- [Metadata Model](../04_Repository/034_METADATA_MODEL.md)
- [Traceability Model](024_TRACEABILITY_MODEL.md)
- [Change Management](023_CHANGE_MANAGEMENT.md)
- [Human Approval Model](025_HUMAN_APPROVAL_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
