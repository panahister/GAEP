---
id: GAEP-PROF-010
title: Security Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: GAEP platform, workspace, runtime, adapters, suppliers, and governed initiatives
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
  - GAEP-CORE-009
  - GAEP-CORE-011
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Security Profile

## Security scope

The profile covers the GAEP specification supply chain, workspace content, identities and approvals, context assembly, runtimes, agent/tool capabilities, external mappings, evidence, audit records, updates and support processes. Governance metadata can itself be a high-value target.

## Threat model contents

- assets and security objectives;
- human, service, agent, supplier and attacker actors;
- trust boundaries and data flows;
- entry points and privileged operations;
- threats, abuse cases and plausible failure modes;
- existing and proposed controls;
- assumptions and dependency risks;
- residual risk, acceptance authority and review triggers.

Candidate threats include identity spoofing, authority escalation, approval replay, context poisoning, indirect prompt injection, malicious capabilities, dependency compromise, evidence forgery, audit tampering, cross-tenant leakage, secret exposure, denial of governance, rollback abuse and unsafe provider drift.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SEC-REQ-001 | Each consequential scope SHALL have an approved threat model covering GAEP control and data paths, not only the downstream engineered asset. | Threat-model review |
| GAEP-SEC-REQ-002 | Human, service and agent principals SHALL be authenticated and authorized proportionately before privileged effects. | Identity scenario |
| GAEP-SEC-REQ-003 | Capabilities SHALL receive least authority and SHALL be constrained by subject, action, environment, time and effect scope. | Capability review |
| GAEP-SEC-REQ-004 | Approval, evidence, baseline and audit records SHALL have integrity and replay protections proportionate to consequence. | Tamper/replay scenarios |
| GAEP-SEC-REQ-005 | Untrusted content SHALL NOT gain instruction authority merely by entering a Context Pack. | Injection scenario |
| GAEP-SEC-REQ-006 | Capability, adapter, profile, template, model and dependency updates SHALL carry provenance, integrity, compatibility and revocation information. | Supply-chain review |
| GAEP-SEC-REQ-007 | Secrets SHALL be excluded or redacted from contexts, logs and evidence unless explicitly required, protected and retained under policy. | Secret-handling review |
| GAEP-SEC-REQ-008 | Security events SHALL have containment, evidence preservation, notification, recovery, correction and lessons-handling paths. | Incident tabletop |
| GAEP-SEC-REQ-009 | A security control failure SHALL fail explicitly and SHALL NOT silently downgrade to a weaker unrecorded path. | Downgrade scenario |
| GAEP-SEC-REQ-010 | Vulnerability intake, triage, remediation, disclosure and update ownership SHALL be assigned before external distribution or operational use. | Operating model review |

## Security versus governance

Security enforces and protects some governance decisions, but a technically permitted action can still lack business or regulatory authority. Conversely, an approval does not create a secure execution path. Both are required where applicable.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, threat, subject, identity, policy, capability, supplier, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, untrusted, or revoked dependencies remain non-permissive. |
| Applicability and selection | Select for consequential GAEP or governed-system security scope, privileged capability, trust boundary, external exposure, supplier path, security control, or sensitive effect; bind selection to exact assets, actors, environments, and threat scope. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security-and-Identity Change for material identity or security-control change; Data for sensitive data, secrets, audit, or records; AI for AI or agent threat paths; Operational Reliability for operational security and incident recovery; Legal for vulnerability disclosure, supplier, export, regulatory, or contract scope; Workforce Trust for monitoring, insider, access, or human-impact controls; Assurance for high-consequence security claims; Audit Integrity when security events or privileged effects require accountable reconstruction; and Incident Response for actual or suspected security incidents and coordinated response, notification, recovery, or continuity. |
| Obligations | Threat modeling, identity and least authority, control-record integrity, injection and supply-chain controls, secret handling, incident response, fail-closed behavior, and vulnerability ownership compose with every applicable domain profile. |
| Permitted variation points | Threat method, review cadence, evidence depth, control implementation, independence, and testing technique may vary by consequence and threat. Accountable identity, least authority, integrity, provenance, revocation, non-waivable policy, and explicit failure are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the manifest identifies Security Authority, threat and risk authorities, eligible approvers, assessment independence, control evidence, vulnerability cadence, and review triggers. |
| Conformance | Conformance requires an exact manifest, approved threat scope, requirement and negative-case evidence, deviations, residual threats, accepted risk, and unresolved supplier or control obligations. |
| Compatibility and conflicts | An authority, trust, control, supplier, or profile conflict remains `conflicted`; capability availability or technical permission never manufactures governance authority. |
| Invalidation, migration, deprecation, and expiry | Change to threat, asset, actor, trust boundary, privilege, policy, capability, dependency, supplier, environment, evidence, or incident state reopens conformance. Profile evolution preserves control, revocation, vulnerability, migration, expiry, and historical evidence mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SEC-REQ-011 | Security-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible asset, threat, identity, policy, profile, capability, and dependency versions. | Composition review |
| GAEP-SEC-REQ-012 | Tailoring SHALL use only declared variation points and SHALL NOT weaken accountable identity, least authority, integrity, provenance, revocation, non-waivable policy, or explicit-failure obligations. | Control-tailoring negative test |
| GAEP-SEC-REQ-013 | A conformance claim SHALL identify the effective manifest, threat scope, evidence for every applicable requirement and required negative case, deviations, residual threats, accepted risk, and unresolved obligations. | Conformance-record review |
| GAEP-SEC-REQ-014 | Material change or profile migration, deprecation, expiry, revocation, or replacement SHALL invalidate affected manifests and SHALL preserve control, consumer, vulnerability, migration, and historical evidence mappings. | Lifecycle-change scenario |

## Required negative cases

- Untrusted content in a Context Pack attempts to obtain instruction authority or invoke a privileged capability.
- An agent, capability, or beneficiary can alter the policy, approval, audit, or evidence record that constrains it.
- A dependency, model, adapter, credential, or supplier changes without provenance or re-evaluation.
- A control failure silently falls back to a weaker path or unapproved provider.
- An authorization, approval, or technical permission is reused after target, actor, policy, or threat context changes.
