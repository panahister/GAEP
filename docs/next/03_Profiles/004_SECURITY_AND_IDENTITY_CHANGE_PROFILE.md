---
id: GAEP-PROF-004
title: Security and Identity Change Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Material authentication, authorization, identity, credential, privilege, trust, or security-control changes
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
  - GAEP-CORE-002
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Security and Identity Change Profile

## Selection

Select for material changes to authentication, authorization, identities, credentials, roles, delegation, trust boundaries, secrets, cryptography, security monitoring, sensitive administrative paths or security-control enforcement.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SECCHG-REQ-001 | The Change SHALL identify affected assets, actors, trust boundaries, privileges, abuse cases and security assumptions. | Threat review |
| GAEP-SECCHG-REQ-002 | Authentication, authorization and accountable-human consequences SHALL be modeled separately. | Identity design review |
| GAEP-SECCHG-REQ-003 | Privilege changes SHALL identify grant, use, delegation, expiry, revocation, emergency and orphaned-access behavior. | Privilege scenarios |
| GAEP-SECCHG-REQ-004 | Secret and credential handling SHALL cover creation, storage, access, transmission, rotation, revocation, recovery and evidence redaction. | Credential lifecycle review |
| GAEP-SECCHG-REQ-005 | Security-relevant failure, bypass, downgrade and partial-migration modes SHALL be tested or explicitly constrained. | Negative scenario review |
| GAEP-SECCHG-REQ-006 | Independent review SHALL be required when the author or executing principal can materially benefit from or conceal unauthorized privilege. | Separation-of-duty review |
| GAEP-SECCHG-REQ-007 | Rollout and rollback SHALL preserve a recoverable administrative path without creating an undocumented bypass. | Recovery tabletop |
| GAEP-SECCHG-REQ-008 | Security telemetry SHALL avoid storing reusable secrets or unnecessary sensitive content and SHALL remain protected from unauthorized alteration. | Logging review |

## Approval boundary

Repository write access or operational access does not prove authority to approve a security change. Authorization binds to exact policies, identities, subject revisions, environments and effect scope.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, policy, identity, subject, capability, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, or cyclic inputs leave resolution non-permissive. |
| Applicability and selection | Select for every material security, trust, authentication, authorization, identity, credential, privilege, cryptographic, monitoring, or enforcement change; identify assets, environments, principals, and selecting authority. |
| Co-selection rules | Mandatory: Security Profile (`GAEP-PROF-010`) for every selected Security-and-Identity Change. Consequence-triggered: select Data for personal data, credentials, audit records, or disclosure; Operational Reliability for live security services and recovery; Legal for supplier, regulatory, export, disclosure, or jurisdiction effects; AI for AI-enabled controls or agent authority; Workforce Trust for monitoring, workforce access, accessibility, or affected-person consequences; Assurance for consequential privilege or trust changes; Audit Integrity when privileged activity or control changes require accountable reconstruction; and Incident Response for active or suspected security incidents and material response or continuity duties. |
| Obligations | Change-specific requirements supplement the continuing Security Profile and effective policy; they do not redefine identity, approval, authorization, or effect semantics owned by Core. |
| Permitted variation points | Review independence, rollout unit, evidence depth, monitoring period, and credential transition pattern may vary by consequence. Least authority, accountable identity, non-waivable policy, expiry, revocation, and recoverable control paths are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; effective configuration identifies Security Authority, eligible approvers, separation constraints, threat and negative-test evidence, and review cadence for temporary or elevated access. |
| Conformance | Conformance requires an exact manifest, Security Profile co-selection, requirement and negative-case evidence, deviations, residual threats, and temporary-access obligations. |
| Compatibility and conflicts | A conflict among privilege, policy, identity, or co-profile obligations remains `conflicted`; repository ownership, tool permission, or self-approval does not resolve it. |
| Invalidation, migration, deprecation, and expiry | Change to identity, role, target, trust boundary, policy, credential, cryptographic material, environment, threat evidence, or rollout state reopens the manifest. Profile evolution preserves access expiry, revocation, compatibility, migration, and historical authorization reconstruction. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SECCHG-REQ-009 | This profile and Security Profile `GAEP-PROF-010` SHALL be co-selected for every applicable Change, with all required profiles and exact compatible versions recorded in the effective manifest. | Composition review |
| GAEP-SECCHG-REQ-010 | Tailoring SHALL remain within declared variation points and SHALL NOT weaken least authority, accountable identity, non-waivable policy, expiry, revocation, separation, or recoverability. | Privilege-tailoring negative test |
| GAEP-SECCHG-REQ-011 | A conformance claim SHALL identify the effective manifest, evidence for every applicable requirement and required negative case, deviations, residual threats, and temporary obligations. | Conformance-record review |
| GAEP-SECCHG-REQ-012 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve access, revocation, compatibility, and historical authorization mappings. | Lifecycle-change scenario |

## Required negative cases

- The author approves a privilege change from which the author can materially benefit.
- Tool, repository, or administrative access is treated as business authorization.
- A changed identity, role, target, or policy reuses an earlier authorization grant.
- Rollback removes the only recoverable administrative path or leaves an undocumented bypass.
- Temporary access, credentials, or downgraded controls survive their expiry or migration window.
