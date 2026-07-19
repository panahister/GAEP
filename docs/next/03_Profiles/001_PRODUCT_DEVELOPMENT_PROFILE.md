---
id: GAEP-PROF-001
title: Product Development Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Product Governance Authority
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

Select this profile when an Initiative creates or materially evolves a Product managed asset. Product is not itself an Initiative; it may be targeted by many Initiatives and Changes throughout its life.

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
| GAEP-PROD-REQ-001 | A Product Initiative SHALL identify the managed Product asset, affected baselines, target users, problem evidence, intended outcomes, scope and non-goals. | Charter review |
| GAEP-PROD-REQ-002 | Product value and user claims SHALL be labeled as evidence-backed, assumed, inferred, or unknown. | Evidence trace review |
| GAEP-PROD-REQ-003 | The selected workflow SHALL identify source authorities and SHALL avoid unowned double entry. | Service/workflow blueprint |
| GAEP-PROD-REQ-004 | Architecture, quality, security, privacy, AI, operational and legal obligations SHALL be selected proportionately through explicit profiles or applicability decisions. | Effective-profile review |
| GAEP-PROD-REQ-005 | Acceptance and release decisions SHALL bind to exact product, requirement, architecture, implementation, test and evidence revisions applicable to the release baseline. | Release scenario |
| GAEP-PROD-REQ-006 | Outcome measures SHALL include countermetrics for burden, harm, quality and gaming where material. | Outcome model review |
| GAEP-PROD-REQ-007 | Operation, support, migration, deprecation, exit and retirement responsibilities SHALL be identified before a consequential release. | Operability review |
| GAEP-PROD-REQ-008 | A claim that a lifecycle or method is proven SHALL reference relevant evidence and scope; otherwise it SHALL be labeled a hypothesis or organizational preference. | Claim review |

## Tailoring

Low-risk internal improvements may use a thin charter and combined roles. Products affecting external users, regulated decisions, money, identity, sensitive data, safety or critical operations require stronger independent evidence and domain profiles. Profile resolution records which obligations were removed, satisfied through reuse, or strengthened and why.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; the effective-configuration manifest pins every Core and profile input to an exact version or digest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`. A missing, incompatible, or cyclic dependency leaves resolution `unresolved` or `conflicted`. |
| Applicability and selection | Select for creation or material evolution of a Product managed asset; record the selecting principal, product, initiative, rationale, exact profile revision, and exclusions. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Architecture for architecture-significant change; Security and Security-and-Identity Change for their respective triggers; Data for personal, confidential, regulated, or records-relevant data; AI for material AI use; Operational Reliability for consequential operation; Legal for distribution, supplier, IP, jurisdiction, or regulated scope; Workforce Trust for workforce, accessibility, or affected-person consequences; Assurance proportionately to critical claims; Audit Integrity when accountable reconstruction is material; and Incident Response when material incident, communication, recovery, continuity, or decision-reopening duties apply. |
| Obligations | The requirements in this profile, applicable dependency requirements, and stronger effective-policy obligations compose without replacement. |
| Permitted variation points | Charter form, artifact representation, evidence depth, review cadence, and role combination may vary by documented consequence and uncertainty. Variation may strengthen obligations but may not remove a required outcome, domain profile, independent review, or Core invariant. |
| Authority, evidence, and cadence | Product Governance Authority owns this profile; the effective configuration identifies approval authorities, evidence methods, independence, and review cadence for the selected outcome areas. |
| Conformance | A claim identifies the effective-configuration manifest, exact versions, satisfied requirements, evidence, negative-case results, deviations, and unresolved obligations. |
| Compatibility and conflicts | A domain conflict or unavailable mandatory co-profile produces `conflicted` or `unresolved`; schedule, convenience, or a local default does not resolve it. |
| Invalidation, migration, deprecation, and expiry | Material change to product scope, users, claims, effects, data, AI, architecture, supplier, environment, policy, evidence, or selected profiles invalidates or reopens the manifest. Profile revision or retirement requires impact analysis, coexistence or migration rules, replacement mapping, and preserved historical reconstruction. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-PROD-REQ-009 | Product-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible versions in the effective-configuration manifest. | Composition scenario |
| GAEP-PROD-REQ-010 | Tailoring SHALL use only the permitted variation points declared in this profile and SHALL NOT weaken Core, effective policy, or a mandatory domain-profile obligation. | Tailoring negative test |
| GAEP-PROD-REQ-011 | A Product Profile conformance claim SHALL identify the effective manifest, evidence for every applicable requirement, required negative-case results, deviations, and unresolved obligations. | Conformance-record review |
| GAEP-PROD-REQ-012 | A material change or profile migration, deprecation, expiry, or replacement SHALL invalidate or reopen affected manifests and SHALL preserve a reconstructable mapping from the old profile revision to its disposition. | Lifecycle-change scenario |

## Required negative cases

- The profile is inferred from repository location, template use, or product naming without an attributable selection record.
- A Product using sensitive data or material AI omits a mandatory domain profile.
- A release decision references an earlier product, evidence, or implementation revision.
- Tailoring removes an outcome because evidence is costly or a deadline is near.
- A deprecated profile revision remains in use without compatibility, migration, or explicit disposition.
