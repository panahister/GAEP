---
id: GAEP-PROF-014
title: Legal, Intellectual Property, and Supplier Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Distribution, third-party content, providers, dependencies, and regulated obligations
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
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Legal, Intellectual Property, and Supplier Profile

## Scope

This profile is jurisdiction-dependent and does not provide legal advice. It ensures that applicable legal, contractual, licensing, supplier and regulatory questions are assigned and evidenced rather than hidden inside security or architecture reviews.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-LEGAL-REQ-001 | Distribution SHALL have an approved ownership, license, contribution and third-party-notice model. | Distribution review |
| GAEP-LEGAL-REQ-002 | Third-party text, code, models, datasets, templates and generated content SHALL have provenance and permitted-use assessment proportionate to intended use. | IP/license review |
| GAEP-LEGAL-REQ-003 | Supplier terms SHALL be assessed for data use, confidentiality, security, audit, availability, change notice, subcontractors, IP, liability, termination, export and portability where applicable. | Supplier assessment |
| GAEP-LEGAL-REQ-004 | Jurisdiction, regulated-use, localization, labor, accessibility, export, sanctions and records obligations SHALL be selected by accountable authorities for the target scope. | Applicability review |
| GAEP-LEGAL-REQ-005 | Contract or policy changes that invalidate an approved use SHALL trigger reassessment, migration, suspension or termination according to risk. | Supplier-change scenario |
| GAEP-LEGAL-REQ-006 | Exit SHALL preserve required records and portability while satisfying deletion, confidentiality, licensing and access-revocation obligations. | Exit tabletop |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact scope, jurisdiction, authority, supplier, contract, license, content, dependency, profile, and policy versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, expired, or revoked legal or supplier inputs remain unresolved. |
| Applicability and selection | Select for distribution, third-party content, dependencies, models, datasets, providers, suppliers, licensing, contractual duties, jurisdiction, export, sanctions, labor, accessibility, records, or regulated obligations; bind selection to exact use and authority scope. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Data for personal, regulated, transferred, retained, or supplier-processed data; AI for models, generated content, AI providers, or AI obligations; Security for executable dependencies, supplier security, vulnerability, or disclosure; Operational Reliability for service suppliers, continuity, portability, or exit; Workforce Trust for labor, accessibility, worker monitoring, or affected persons; Audit Integrity for mandated audit, record, or reconstruction duties; and Incident Response for notification, supplier incident, continuity, or coordinated response obligations. |
| Obligations | Applicable legal, regulatory, contractual, licensing, supplier, provenance, notification, portability, termination, and records obligations remain distinct and are assigned to accountable authorities. |
| Permitted variation points | Assessment depth, evidence form, review cadence, notice workflow, supplier tiering, and exit exercise frequency may vary within controlling authority. Applicability decisions, permitted-use boundaries, required notices, records duties, sanctions or export constraints, termination, and deletion or confidentiality obligations are not local variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the manifest identifies Legal and Supplier Authority plus accountable legal, procurement, IP, regulatory, records, and supplier owners, approved interpretations, evidence, and review or renewal dates. |
| Conformance | Conformance requires an exact manifest, authority-backed applicability, supplier and content inventory, requirement and negative-case evidence, deviations, expiries, and unresolved interpretations or obligations. |
| Compatibility and conflicts | Legal, regulatory, contractual, licensing, privacy, records, security, and supplier conflicts remain explicit and identify the controlling authority; technical feasibility does not resolve them. |
| Invalidation, migration, deprecation, and expiry | Change to use, jurisdiction, law or policy input, supplier, subcontractor, term, license, content provenance, model, dataset, transfer, notice, dependency, or exit feasibility reopens the manifest. Profile evolution preserves applicability, approval, contract, license, supplier, notice, records, migration, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-LEGAL-REQ-007 | Legal-profile selection and every required co-selection SHALL be explicit, attributable, authority-backed, and bound to exact compatible scope, jurisdiction, supplier, contract, license, content, dependency, policy, and profile versions. | Composition and applicability review |
| GAEP-LEGAL-REQ-008 | Tailoring SHALL use only declared variation points and SHALL NOT weaken an applicable permitted-use boundary, notice, records, export or sanctions, termination, confidentiality, deletion, or affected-person obligation. | Legal-tailoring negative test |
| GAEP-LEGAL-REQ-009 | A conformance claim SHALL identify the effective manifest, accountable applicability decisions, evidence for every applicable requirement and required negative case, deviations, expiry, and unresolved interpretations or obligations. | Conformance-record review |
| GAEP-LEGAL-REQ-010 | Material change or profile migration, deprecation, expiry, revocation, or replacement SHALL invalidate affected manifests and SHALL preserve applicability, approval, contract, license, supplier, notice, records, migration, exit, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- A supplier, model, dataset, license, term, subcontractor, jurisdiction, or intended use changes without reassessment.
- Generated content is assumed free of provenance, licensing, or permitted-use constraints.
- Technical access or purchase is treated as legal permission for processing, distribution, export, or regulated use.
- Supplier exit loses required records, portability, deletion, confidentiality, or access-revocation obligations.
- A legal or contractual conflict is silently resolved by a lower-authority project default.
