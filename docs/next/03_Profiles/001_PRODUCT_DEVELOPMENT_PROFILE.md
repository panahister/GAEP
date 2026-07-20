---
id: GAEP-PROF-001
title: Product Development Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Creation and material evolution of a managed Product asset
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
  - GAEP-CORE-005
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references:
  - ../../03_Product_Engineering/021_PRODUCT_LIFECYCLE.md
supersedes: []
---

# Product Development Profile

## Selection

Select this profile through an attributable Profile Selection Manifest when one exact Initiative creates or materially evolves one exact Product Managed Asset. Product is not itself an Initiative; it may be targeted by many Initiatives and Changes throughout its life. A legacy Product-Initiative classification, repository location, file presence, or display name is not a candidate Profile selection. If a version-bound mapping cannot resolve distinct Product and Initiative identities and the applicable Product baseline, applicability remains `unresolved`.

## Outcome areas

The profile evaluates outcomes rather than requiring one universal sequence:

- evidenced problem and target users;
- product charter, intended value, scope and non-goals;
- stakeholder impact and outcome measures;
- applicable policy, risk, security, data, AI and assurance profiles;
- architecture and quality-attribute decisions;
- delivery and acceptance strategy;
- release, operations, support and feedback;
- evolution, compatibility, deprecation and retirement.

An outcome may be satisfied locally, through approved reuse, or declared not applicable with rationale. A missing required outcome cannot be hidden by marking the lifecycle phase complete.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-PROD-REQ-001 | A bounded Initiative targeting a Product Managed Asset SHALL identify distinct canonical Product and Initiative identities, the exact affected Product baseline or an explicit genesis/no-prior-baseline declaration, target users, problem evidence, intended outcomes, scope and non-goals. | Charter, identity, and baseline review |
| GAEP-PROD-REQ-002 | Product value and user claims SHALL be labeled as evidence-backed, assumed, inferred, or unknown. | Evidence trace review |
| GAEP-PROD-REQ-003 | The selected workflow SHALL identify source authorities and SHALL avoid unowned double entry. | Service/workflow blueprint |
| GAEP-PROD-REQ-004 | Architecture, quality, security, privacy, AI, operational and legal obligations SHALL be selected proportionately through explicit profiles or applicability decisions. | Effective-profile review |
| GAEP-PROD-REQ-005 | Acceptance and release decisions SHALL bind to exact product, requirement, architecture, implementation, test and evidence revisions applicable to the release baseline. | Release scenario |
| GAEP-PROD-REQ-006 | Outcome measures SHALL include countermetrics for burden, harm, quality and gaming where material. | Outcome model review |
| GAEP-PROD-REQ-007 | Operation, support, migration, deprecation, exit and retirement responsibilities SHALL be identified before a consequential release. Initiative closure SHALL NOT be treated as Product retirement, and Product retirement SHALL preserve required Initiative and Change history. | Operability, closure, and retirement review |
| GAEP-PROD-REQ-008 | A claim that a lifecycle or method is proven SHALL reference relevant evidence and scope; otherwise it SHALL be labeled a hypothesis or organizational preference. | Claim review |

## Tailoring

Low-risk internal improvements may use a thin charter and combined roles. Products affecting external users, regulated decisions, money, identity, sensitive data, safety or critical operations require stronger independent evidence and domain profiles. Profile resolution records which obligations were removed, satisfied through reuse, or strengthened and why.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; the effective-configuration manifest pins every Core and profile input to an exact version or digest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`. A missing, incompatible, or cyclic dependency leaves resolution `unresolved` or `conflicted`. |
| Applicability and selection | Select for creation or material evolution of an exact Product Managed Asset by an exact Initiative; record the selecting Principal, canonical Product and Initiative Scope References, applicable Product baseline or explicit genesis declaration, rationale, exact profile revision, and exclusions. A legacy classification or unresolved identity/cardinality mapping cannot make this Profile applicable or effective. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Architecture for architecture-significant change; Security and Security-and-Identity Change for their respective triggers; Data for personal, confidential, regulated, or records-relevant data; AI for material AI use; Operational Reliability for consequential operation; Legal for distribution, supplier, IP, jurisdiction, or regulated scope; Workforce Trust for workforce, accessibility, or affected-person consequences; Assurance proportionately to critical claims; Audit Integrity when accountable reconstruction is material; and Incident Response when material incident, communication, recovery, continuity, or decision-reopening duties apply. |
| Obligations | The requirements in this profile, applicable dependency requirements, and stronger effective-policy obligations compose without replacement. |
| Permitted variation points | Charter form, artifact representation, evidence depth, review cadence, and role combination may vary by documented consequence and uncertainty. Variation may strengthen obligations but may not remove a required outcome, domain profile, independent review, or Core invariant. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the effective configuration identifies Product Governance Authority and other approval authorities, evidence methods, independence, and review cadence for the selected outcome areas. |
| Conformance | A claim identifies the effective-configuration manifest, exact versions, satisfied requirements, evidence, negative-case results, deviations, and unresolved obligations. |
| Compatibility and conflicts | A domain conflict or unavailable mandatory co-profile produces `conflicted` or `unresolved`; schedule, convenience, or a local default does not resolve it. |
| Invalidation, migration, deprecation, and expiry | Material change to product scope, users, claims, effects, data, AI, architecture, supplier, environment, policy, evidence, or selected profiles invalidates or reopens the manifest. Profile revision or retirement requires impact analysis, coexistence or migration rules, replacement mapping, and preserved historical reconstruction. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-PROD-REQ-009 | Product-profile selection and every required co-selection SHALL be explicit, attributable, bound to distinct canonical Product and Initiative references, and bound to exact compatible versions in the effective-configuration manifest. An unresolved source mapping SHALL preserve applicability as `unresolved` rather than activate the Profile. | Composition and migration-applicability scenario |
| GAEP-PROD-REQ-010 | Tailoring SHALL use only the permitted variation points declared in this profile and SHALL NOT weaken Core, effective policy, or a mandatory domain-profile obligation. | Tailoring negative test |
| GAEP-PROD-REQ-011 | A Product Profile conformance claim SHALL identify the exact Product Managed Asset, governing Initiative, affected Product and profile revisions, effective manifest, evidence for every applicable requirement, required negative-case results, deviations, and unresolved obligations. | Conformance-record and subject-binding review |
| GAEP-PROD-REQ-012 | A material Product, Initiative, identity-mapping, or profile change, migration, deprecation, expiry, or replacement SHALL invalidate or reopen affected manifests and SHALL preserve a reconstructable version-bound mapping from every prior Product, Initiative, and profile reference to its disposition without rewriting legacy meaning. | Lifecycle, mapping, and historical-reconstruction scenario |

## Required negative cases

- The profile is inferred from repository location, template use, or product naming without an attributable selection record.
- A legacy Product-Initiative classification is treated as both the candidate Product identity and Initiative identity without a version-bound mapping.
- An unresolved one-to-many legacy mapping is treated as an applicable or effective Product Profile selection.
- Closing a Product-targeting Initiative is treated as retiring the Product or ending its operational state.
- A Product using sensitive data or material AI omits a mandatory domain profile.
- A release decision references an earlier product, evidence, or implementation revision.
- Tailoring removes an outcome because evidence is costly or a deadline is near.
- A deprecated profile revision remains in use without compatibility, migration, or explicit disposition.
