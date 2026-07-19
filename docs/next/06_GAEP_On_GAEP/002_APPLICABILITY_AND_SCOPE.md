---
id: GAEP-SELF-002
title: GAEP-on-GAEP Applicability and Scope
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP Next pre-implementation restructuring initiative
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-SELF-001
  - GAEP-CORE-009
informative_references:
  - ../00_GAEP_Product_Strategy/005_SCOPE_AND_CAPABILITY_STRATEGY.md
supersedes: []
---

# GAEP-on-GAEP Applicability and Scope

## Manifest status

Manifest ID: `urn:gaep:candidate:effective-profile-manifest:vnext-working`

Manifest result: `unresolved`.

This is a candidate selection manifest for evaluation. No profile is effective through this record because profile-selection authority, organizational bindings, Approval Determinations, and final exact versions are unassigned. File presence does not select a profile.

## Prerequisite records outside profile resolution

Product Strategy and Core documents are inputs to profile resolution; they are not Profiles and do not receive a `GAEP-CORE-009` resolution result in this manifest.

| Candidate subject/version | Authoring/approval condition | Evidence readiness | Candidate owner role | Current blockers |
|---|---|---|---|---|
| Product Charter `GAEP-STR-001@0.1.0` | Proposed; not approved | candidate local revision | GAEP Product Owner, unassigned | sponsor, segment and distribution unresolved |
| Problem Evidence `GAEP-STR-002@0.1.0` | Proposed; not approved | research planned | GAEP Product Research Owner, unassigned | no interviews or historical-case evidence |
| Core `GAEP-CORE-001` through `GAEP-CORE-012`, each at `0.1.0` | Proposed; not approved or baselined | candidate local revisions exist | GAEP Specification Steward, unassigned | integration review, scenarios and baseline approval pending |

## Candidate Profile applicability and resolution

This manifest deliberately separates selection obligation, Core resolution result, fulfillment evidence, selection authority, and blocking reason.

| Candidate subject/version | Obligation | Core resolution result | Fulfillment evidence | Selection authority | Current blockers |
|---|---|---|---|---|---|
| Product Development `GAEP-PROF-001@0.1.0` | required | unresolved | candidate profile exists; not effective | Product Governance Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | first segment/user/workflow unvalidated |
| Reusable Asset Change `GAEP-PROF-007@0.1.0` | required | unresolved | candidate profile exists; not effective | Capability Steward, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | consumer and compatibility model not piloted |
| Architecture `GAEP-PROF-008@0.1.0` | required | unresolved | candidate profile exists; not effective | Architecture Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | approved quality-attribute scenarios missing |
| Assurance `GAEP-PROF-009@0.1.0` | required | unresolved | candidate profile exists; not effective | Assurance Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | evidence-strength and critical-claim decisions pending |
| Platform Security `GAEP-PROF-010@0.1.0` | required | unresolved | candidate threat model exists; profile not effective | Security Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | deployment boundary and residual-risk authority missing |
| Data/Privacy/Records `GAEP-PROF-011@0.1.0` | required | unresolved | candidate assessment exists; profile not effective | Data and Privacy Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | data inventory, jurisdiction and records authority missing |
| AI System `GAEP-PROF-012@0.1.0` | conditional because AI-assisted authorship is current and future product use is possible | unresolved | candidate assessment exists; profile not effective | AI System Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | use case, autonomy, provider, provenance limits and evaluation not approved |
| Operational Reliability `GAEP-PROF-013@0.1.0` | conditional for a future supported runtime/product | unresolved | candidate profile exists; not effective | Operational Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | service form, SLOs, support and continuity unresolved |
| Legal/IP/Supplier `GAEP-PROF-014@0.1.0` | required before distribution or supplier authorization | unresolved | candidate profile exists; not effective | Legal and Supplier Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | ownership, license, supplier and jurisdiction review missing |
| Workforce Trust/Accessibility/Ethics `GAEP-PROF-015@0.1.0` | required for pilots and telemetry | unresolved | candidate profile exists; not effective | Organizational Trust Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | participant protocol and accessibility evidence missing |
| Audit Integrity/Accountability `GAEP-PROF-016@0.1.0` | conditional when consequence, policy, external commitment, or accountability claim requires stronger audit properties | unresolved | candidate profile exists; not effective | Audit Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | selection triggers, coverage, integrity method and independent challenge unresolved |
| Incident Response/Continuity `GAEP-PROF-017@0.1.0` | conditional when a material incident or future operational scope requires coordinated response and continuity | unresolved | candidate profile exists; not effective | Incident and Continuity Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | current documentation scope trigger, declaration authority, communication and continuity method unresolved |
| Corrective Change `GAEP-PROF-002@0.1.0` | optional scenario coverage | unresolved | candidate profile exists; not effective | Engineering Change Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | reference scenario only |
| Migration `GAEP-PROF-003@0.1.0` | optional scenario coverage | unresolved | candidate profile exists; not effective | Migration Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | reference scenario only |
| Security/Identity Change `GAEP-PROF-004@0.1.0` | optional scenario coverage | unresolved | candidate profile exists; not effective | Security Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | reference scenario only |
| Emergency Operational Change `GAEP-PROF-005@0.1.0` | optional scenario coverage | unresolved | candidate profile exists; not effective | Operational Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | reference scenario only |
| Bounded Experiment `GAEP-PROF-006@0.1.0` | required for manual pilot design | unresolved | candidate profile exists; not effective | Experiment Authority, unassigned; concrete Principal assignment and authority pending `GAEP-DEC-018` | pilot readiness not evaluated |

Actual selection requires exact profile revisions, Core compatibility, source authority, scope, applicability rationale, effective time, Approval Determination, and a resolved effective-configuration manifest under GAEP-CORE-009. File presence does not make the Audit Integrity or Incident Response profile universally applicable.

## Deferred realization and capability recommendations

The dispositions below are Recommendations tied to `GAEP-DEC-016`; they are not Decision Outcomes, approved roadmap commitments, or promises of later implementation. AI dependence additionally remains governed by `GAEP-DEC-009` and `GAEP-DEC-015`.

| Subject | Recommendation | Decision link | Reason |
|---|---|---|---|
| Runtime Realization `GAEP-REAL-002@0.1.0` | retain as paper boundary only | GAEP-DEC-016 | implementation is unauthorized |
| Codex/Claude delta profiles | use only as informative evaluation inputs | GAEP-DEC-009, GAEP-DEC-015 | current provider conformance is not evaluated |
| Multi-agent execution | defer from first-horizon scope | GAEP-DEC-016 | no first-workflow evidence and correlated assurance risk |
| Knowledge graph | defer from first-horizon scope | GAEP-DEC-016 | no demonstrated query need |
| Commercial ecosystem | make no disposition yet | GAEP-DEC-010, GAEP-DEC-016 | product mode and licensing are undecided |

## Scope boundaries

### In scope now

- product and operating assumptions;
- normative information architecture;
- Core and profile semantics;
- GAEP platform threat, data, AI, assurance, and operational models;
- repository/runtime/adapter boundaries;
- GAEP-on-GAEP records;
- manual scenarios, pilot design, metrics, migration, and approval gates;
- documentation and consistency validation.

### Out of scope now

- source code or executable schemas;
- live AI or external-system integrations;
- migration of organizational production artifacts;
- automatic enforcement;
- public claims, certification, or deployment;
- removal of the legacy corpus before an approved migration decision.

## Risk posture

The current work has low direct operational effect because it changes only a proposed documentation area. Its strategic risk is high: incorrect semantics can later shape authorization, data handling, engineering decisions, and automation. Therefore the candidate requires broad paper review even though it requires no production change approval.
