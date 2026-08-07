---
id: GAEP-REG-003
title: Reference Entry Contract
document_type: registry
schema_version: 1.0
version: 0.4.0
status: proposed
owner_role: GAEP Reference Steward
scope: External references used by GAEP specifications, profiles, decisions, and evidence
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring extended by P01 canonical-reference controls
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
informative_references:
  - ../../99_References/990_REFERENCES.md
  - 011_METHODOLOGY_REFERENCE_CATALOG.json
supersedes: []
---

# Reference Entry Contract

## Canonical catalog boundary

`GAEP-REG-011` is the canonical machine-readable Methodology Reference Catalog. Human-readable crosswalks, Guideline content, lifecycle views, benchmark views, UI text, and exports are derived projections; they must not become independent reference truth.

The catalog has no authority, approval, baseline, conformance, release, or authorization effect merely because it is valid or committed. External references remain informative unless an exact normative dependency is separately proposed and approved under the applicable authority.

## Required reference fields

Every assessed `references` entry shall contain these exact fields:

- `referenceId`;
- `canonicalName`;
- `shortName`;
- `referenceType`;
- `issuingAuthority`;
- `versionOrEdition`;
- `publicationDate` (an ISO date, partial ISO date, or `null` when the official source supplies none);
- `status`;
- `officialUri`;
- `checkedAt`;
- `accessEvidence`;
- `licenseOrCopyrightNote`;
- `supersedes`;
- `supersededBy`;
- `underRevision`;
- `gaepConcernIds`;
- `adoptedConcepts`;
- `adaptedConcepts`;
- `explicitlyNotAdopted`;
- `applicabilityProfiles`;
- `limitations`;
- `claimLanguage`;
- `evidenceStatus`;
- `reviewTrigger`;
- `nextReviewAt`;
- `notes`.

The catalog itself shall additionally identify its stable catalog ID, schema version, content version, authoring status, owner role, exact check date, separate approval state, authority effect, claim boundary, concern registry, assessed references, and preserved deferred candidates.

## Evidence and relationship states

The canonical catalog uses these closed reference types: `standard`, `framework`, `methodology`, `method`, `model`, `principle-set`, `research-program`, `metric-framework`, `regulatory-guidance`, and `visualization-model`.

Reference status is one of `current`, `current-under-revision`, `superseded`, `historical`, `candidate`, or `unverifiable`. `underRevision` remains an independent boolean checked for compatibility with the status.

`accessEvidence` says what was actually reviewed and is one of `full-primary-source-reviewed`, `licensed-copy-reviewed`, `official-publication-reviewed`, `official-summary-reviewed`, `official-abstract-only`, or `unverified`. A paid or licensed source whose full content was not reviewed may support only claims available from the reviewed official page, summary, or abstract.

`evidenceStatus` is one of `primary-source-verified`, `partially-verified`, `version-pending`, `superseded`, or `unverified`. It describes the verification performed, not the truth or effectiveness of the source's intended outcome. `adoptedConcepts`, `adaptedConcepts`, and `explicitlyNotAdopted` are non-interchangeable. An empty `adoptedConcepts` list is valid and prevents informative calibration from being mislabeled direct adoption.

Concern mappings use `adopt`, `adapt`, `reject`, `optional`, or `gaep-native`. A GAEP-native row has no external reference owner. A supported source or method never becomes universally mandatory merely because it is registered.

Deferred candidates are preserved research leads, not assessed references. They must expose their unresolved state and a review trigger, and they cannot support material reliance or claim language.

No external reference or mapping establishes GAEP or external-standard conformance by inference. A conformance claim requires a separately approved, version-bound mapping and evidence case against the actual criteria.

## Claims and citation policy

### Allowed only with exact qualification

- `aligned with`: an exact, version-bound mapping exists and exposes differences; this is not conformance;
- `informed by`: reviewed source material influenced the declared rationale within the access limitation;
- `adapted from`: GAEP intentionally changed the source concept and exposes the adaptation;
- `uses concepts from`: selected concepts are used without adopting the whole reference;
- `designed to support`: a capability intention is stated without claiming an achieved result;
- `candidate conformance mapping`: an unapproved mapping exists for evaluation; and
- `not independently verified`: the relevant mapping, evidence, or outcome lacks independent review.

### Restricted pending separate evidence and authority

`compliant`, `certified`, `conforms to`, `guarantees`, `eliminates`, `enterprise-ready`, `production-ready`, `secure`, `safe`, `audit-proof`, `regulator-approved`, `industry standard`, and `superior` require an exact separately governed claim case. Citation, schema validity, test passage, tool installation, or source presence is never sufficient.

Every external, methodology, compliance, executive, or public claim must bind:

- exact claim subject and version;
- exact external source identity, version, official URI, and checked date;
- evidence and access status;
- claim scope and intended audience;
- limitations, exclusions, uncertainty, and counter-evidence;
- accountable claim owner and eligible approver;
- approval and publication-authority state; and
- expiry, invalidation, or review trigger.

P02 may create the market benchmark and executive claim registry from these fields. P01 supplies policy only and grants no publication authority.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REF-REQ-001 | A reference used to support a normative or assurance claim SHALL identify an exact version or SHALL expose version uncertainty. | Reference review |
| GAEP-REF-REQ-002 | A reference SHALL identify its intended use and SHALL NOT become normative merely by appearing in a bibliography. | Dependency review |
| GAEP-REF-REQ-003 | Proprietary or copyrighted material SHALL be summarized, quoted and stored only within applicable rights. | Rights review |
| GAEP-REF-REQ-004 | A superseded, withdrawn, unavailable or materially changed reference SHALL trigger review of dependent claims and mappings. | Change scenario |
| GAEP-REF-REQ-005 | External standards mappings SHALL identify relationship type, assessor, rationale, source/target versions and review date. | Crosswalk review |
| GAEP-REF-REQ-006 | A reference without an exact edition, version, or revision SHALL use `unverifiable` or remain a deferred candidate and SHALL identify a review trigger and the claims blocked from relying on it. | Version-uncertainty gate |
| GAEP-REF-REQ-007 | Every reference SHALL record access date and review date separately, or explicit `not-accessed` and `not-reviewed` values with reason. | Date-field validation |
| GAEP-REF-REQ-008 | Every mapping SHALL identify assessor Principal or explicit unassigned assessor role, accountable owner role, exact GAEP source and target versions, registered relationship type, rationale, limitations, and next review trigger. | Mapping-record validation |
| GAEP-REF-REQ-009 | Every reference SHALL expose rights/licensing status as `confirmed-permitted`, `link-and-summary-only`, `permission-required`, `unresolved`, or another registered extension value before content is stored, quoted, transformed, or distributed. | Rights-state review |
| GAEP-REF-REQ-010 | Citation, similarity, relationship mapping, or use as calibration evidence SHALL NOT imply GAEP conformance, certification, endorsement, equivalence, or conformance to the external source. | Conformance-inference negative test |
| GAEP-REF-REQ-011 | A crosswalk used by an approval or release gate SHALL contain no unresolved source version, assessor, mapping, review-date, or rights field for any relied-upon row. | Release-crosswalk completeness test |
| GAEP-REF-REQ-012 | One versioned machine-readable catalog SHALL own methodology-reference identity, version, access evidence, mapping, limitation, claim language, and review triggers; every human or UI representation SHALL be a synchronized projection. | Catalog and projection validation |
| GAEP-REF-REQ-013 | Every assessed reference SHALL contain the exact required P01 field set and SHALL resolve every `gaepConcernIds` value to the catalog concern registry. | JSON schema and reference validation |
| GAEP-REF-REQ-014 | Every assessed reference SHALL distinguish direct adoption, adaptation, explicit non-adoption, and deferred or optional applicability. | Relationship-state validation |
| GAEP-REF-REQ-015 | A source reviewed only through an official abstract, summary, or licensed-access page SHALL NOT support detailed normative inference that is absent from the reviewed material. | Access-evidence negative review |
| GAEP-REF-REQ-016 | Every source version, official URI, check date, supersession state, revision state, rights limitation, evidence status, review trigger, and next review date SHALL be explicit and machine-validatable. | Catalog validation |
| GAEP-REF-REQ-017 | A deferred candidate SHALL NOT appear in an assessed-reference projection or support claim language until it satisfies the full reference contract. | Deferred-candidate negative test |
| GAEP-REF-REQ-018 | A public methodology or alignment claim SHALL use the exact version-bound `claimLanguage` or a separately approved stronger claim backed by an exact mapping and evidence case. | Claim-language audit |
| GAEP-REF-REQ-019 | Catalog serialization, reference identity, concern identity, mapping identity, and semantically unordered string collections SHALL use the registered canonical order and SHALL fail validation on drift. | Canonical-ordering and hostile-fixture test |
| GAEP-REF-REQ-020 | Human crosswalk, P02, P03, Guideline, lifecycle, UI, Chat, and export projections SHALL resolve catalog ID and exact version and SHALL NOT maintain independent reference values. | Projection-lineage validation |
| GAEP-REF-REQ-021 | A methodology, method, framework, model, research program, metric framework, principle set, visualization model, tool, provider, adapter, and competitor Product SHALL NOT be silently reclassified as another kind. | Type-confusion negative test |
| GAEP-REF-REQ-022 | Every methodology, compliance, executive, or public claim SHALL bind exact subject, source version, checked date, evidence state, scope, limitations, owner, approval state, and review trigger. | Claim-record validation |
