---
id: GAEP-PROF-007
title: Reusable Asset Change Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Capability Steward
scope: Shared templates, policies, profiles, libraries, workflows, skills, adapters, boilerplates, and organizational assets
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
  - GAEP-CORE-003
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Reusable Asset Change Profile

## Selection

Select when changing an asset intended for reuse across initiatives, products, repositories, teams or organizations. Reuse increases blast radius and does not automatically increase authority.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REUSE-REQ-001 | The asset SHALL identify publisher, owner, scope, version, compatibility, dependencies, provenance, integrity, support and retirement information. | Asset record review |
| GAEP-REUSE-REQ-002 | Known consumers and discovery confidence SHALL be recorded; unknown consumers SHALL remain explicit risk. | Consumer inventory review |
| GAEP-REUSE-REQ-003 | A change SHALL classify semantic, security, data, operational and compatibility impact rather than relying only on version-number convention. | Impact review |
| GAEP-REUSE-REQ-004 | Consumer adoption SHALL remain an explicit binding decision unless approved policy mandates the update. | Binding scenario |
| GAEP-REUSE-REQ-005 | Breaking or high-risk changes SHALL provide migration, coexistence, rollback, communication and deprecation plans. | Release review |
| GAEP-REUSE-REQ-006 | Templates, skills, agents and adapters SHALL be treated as supply-chain capabilities and SHALL carry applicable trust and evaluation evidence. | Supply-chain review |
| GAEP-REUSE-REQ-007 | Organizational reuse SHALL NOT silently override initiative-specific constraints or stronger policy. | Profile conflict scenario |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact asset, dependency, profile, policy, and consumer-relevant versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; the reusable asset also declares explicit compatible ranges for its own dependencies. Missing, incompatible, or cyclic dependencies block conformance. |
| Applicability and selection | Select when an asset is intended for reuse across governed scopes; record publisher, owner, selecting principal, asset revision, consumer boundary, rationale, and exclusions. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security for executable, privileged, externally sourced, or integrity-sensitive assets; Legal for distribution, licensing, supplier, or third-party content; Data for data-handling assets; AI for model, prompt, agent, evaluation, or AI adapter assets; Operational Reliability for operational components; Workforce Trust for human-process, monitoring, or accessibility effects; Assurance for high-blast-radius claims; Audit Integrity when asset use or update history requires accountable reconstruction; and Incident Response when the asset participates in detection, response, recovery, continuity, or notification. |
| Obligations | Publisher and consumer obligations coexist: publication does not grant adoption authority, and adoption does not erase the asset's provenance, integrity, compatibility, migration, or support requirements. |
| Permitted variation points | Packaging, distribution channel, support period, evidence depth, review cadence, and migration window may vary by asset type and blast radius. Provenance, exact versioning, integrity, compatibility, adoption authority, and retirement disposition are not variation points. |
| Authority, evidence, and cadence | Capability Steward owns the profile; the manifest identifies publisher and consumer authorities, qualification evidence, compatibility evidence, review cadence, and support or end-of-life dates. |
| Conformance | Conformance requires an exact manifest, dependency graph, consumer and compatibility evidence, requirement and negative-case results, deviations, and known-unknown consumer risk. |
| Compatibility and conflicts | An incompatible consumer requirement or higher-authority constraint remains `conflicted`; version-number convention or organizational publication does not resolve it. |
| Invalidation, migration, deprecation, and expiry | Change to semantics, publisher, provenance, integrity, dependency, compatibility range, support, consumers, threat evidence, or policy invalidates affected claims. Deprecation identifies replacement, coexistence, migration, notice, expiry, revocation, and historical reconstruction. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REUSE-REQ-008 | Reusable-asset profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible profile, asset, and dependency versions. | Composition and graph review |
| GAEP-REUSE-REQ-009 | Tailoring SHALL use only declared variation points and SHALL NOT weaken provenance, integrity, compatibility, consumer adoption authority, migration, or retirement obligations. | Tailoring negative test |
| GAEP-REUSE-REQ-010 | A conformance claim SHALL identify the effective manifest, dependency graph, evidence for every applicable requirement and required negative case, deviations, and consumer-discovery uncertainty. | Conformance-record review |
| GAEP-REUSE-REQ-011 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve consumer, compatibility, coexistence, migration, notice, support, and historical-version mappings. | Lifecycle-change scenario |

## Required negative cases

- A consumer adopts an asset because it was published, without an attributable binding decision.
- A dependency or asset changes incompatibly while the same conformance claim remains attached.
- A template, agent, skill, or adapter carries hidden authority or unverified external instructions.
- A deprecated asset has no replacement mapping, consumer notice, migration window, or terminal disposition.
- Unknown consumers are represented as zero consumers.
