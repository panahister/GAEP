---
id: GAEP-PROF-013
title: Operational Reliability Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Operational Authority
scope: Operational services, runtimes, integrations, and consequential managed assets
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
  - GAEP-CORE-011
informative_references: []
supersedes: []
---

# Operational Reliability Profile

## Operational model

Identify service ownership, users and dependencies, environments, critical journeys, service objectives, capacity, cost, support, change windows, observability, incidents, recovery, continuity, backups, configuration, supplier dependencies, maintenance, deprecation and exit.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-OPS-REQ-001 | A consequential operational capability SHALL have named service, support, security, data and incident ownership. | Ownership review |
| GAEP-OPS-REQ-002 | Reliability and performance expectations SHALL be expressed as measurable user- or system-relevant objectives with observation methods. | SLO review |
| GAEP-OPS-REQ-003 | Monitoring SHALL cover success, partial effects, denied/stopped work, latency, capacity, cost, dependencies, integrity and material quality signals. | Observability review |
| GAEP-OPS-REQ-004 | Incident handling SHALL define detection, triage, containment, authority, communication, evidence, recovery, correction, review and decision reopening. | Incident tabletop |
| GAEP-OPS-REQ-005 | Backup and recovery SHALL be tested against exact recovery objectives and SHALL include governance records, mappings and required external dependencies. | Recovery evidence |
| GAEP-OPS-REQ-006 | Degraded and manual operation SHALL declare preserved functions, unavailable guarantees, user communication, reconciliation and return-to-normal criteria. | Degraded-mode scenario |
| GAEP-OPS-REQ-007 | Capacity, cost, rate, quota and supplier limits SHALL influence design and authorization where they can cause unsafe partial work or denial. | Capacity scenario |
| GAEP-OPS-REQ-008 | Configuration and release changes SHALL be versioned, authorized, observable, recoverable and linked to outcomes. | Change record review |
| GAEP-OPS-REQ-009 | Deprecation and retirement SHALL cover consumers, records, data, access, support, compatibility, export and unresolved obligations. | Retirement review |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact service, runtime, configuration, dependency, profile, policy, release, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, unavailable, or degraded dependencies remain explicit in resolution. |
| Applicability and selection | Select for consequential operational services, runtimes, integrations, or managed assets; record service and support owners, users, environments, critical journeys, dependencies, selecting principal, and exact profile revision. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security for operational threats and controls; Data for operational data, telemetry, backup, or records; AI for AI-supported operation; Legal for suppliers, service commitments, notification, jurisdiction, or exit; Workforce Trust for on-call burden, monitoring, accessibility, or human operation; Audit Integrity for material operational accountability and reconstruction; Incident Response for material incident, continuity, notification, or recovery needs; and Emergency Operational Change only when its qualifying active condition exists. |
| Obligations | Service objectives, monitoring, incidents, recovery, degraded operation, capacity, configuration, release, supplier, deprecation, and retirement obligations remain distinct and cumulative. |
| Permitted variation points | Service objectives, monitoring cadence, recovery technique, deployment unit, support model, review independence, and evidence depth may vary by consequence and uncertainty. Named ownership, observable outcomes, incident authority, tested recovery, explicit degradation, and retirement disposition are not variation points. |
| Authority, evidence, and cadence | Operational Authority owns the profile; the manifest identifies service, support, security, data, incident, and continuity owners, evidence methods, review cadence, and recovery-test schedule. |
| Conformance | Conformance requires an exact manifest, service and dependency model, requirement and negative-case evidence, deviations, degraded guarantees, incidents, residual risk, and unresolved obligations. |
| Compatibility and conflicts | Conflicting service, security, data, supplier, capacity, recovery, or profile constraints remain `conflicted`; availability pressure does not silently lower a control. |
| Invalidation, migration, deprecation, and expiry | Change to service objective, critical journey, environment, dependency, supplier, capacity, configuration, release, recovery evidence, incident state, policy, or ownership reopens conformance. Profile evolution preserves service, consumer, incident, recovery, migration, deprecation, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-OPS-REQ-010 | Operational-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible service, runtime, configuration, dependency, policy, release, and profile versions. | Composition and service review |
| GAEP-OPS-REQ-011 | Tailoring SHALL use only declared variation points and SHALL NOT weaken named ownership, observable outcomes, incident authority, tested recovery, explicit degradation, or retirement disposition. | Operational-tailoring negative test |
| GAEP-OPS-REQ-012 | A conformance claim SHALL identify the effective manifest, service and dependency model, evidence for every applicable requirement and required negative case, deviations, degraded guarantees, incidents, and unresolved obligations. | Conformance-record review |
| GAEP-OPS-REQ-013 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve service, consumer, incident, recovery, compatibility, migration, retirement, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- A partial, uncertain, or failed effect is reported as service success.
- Monitoring covers uptime but omits integrity, denied or stopped work, partial effects, dependencies, cost, or material quality.
- Backup existence is treated as recovery evidence without testing exact objectives and dependencies.
- Degraded mode silently drops a security, data, audit, or user guarantee.
- Supplier, capacity, configuration, or release change continues under stale operational evidence.
