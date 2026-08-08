---
id: GAEP-REG-012
title: Market Evidence and Benchmark Contract
document_type: registry
schema_version: 1.0
version: 0.1.1
status: proposed
owner_role: GAEP Product Research Owner
scope: P02 market evidence, evaluated-product identity, capability comparison, executive claims, and adoption decision support
normative_level: normative
classification: internal
provenance: P02 evidence-governed market research and benchmark design
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-REG-003
  - GAEP-CORE-007
  - GAEP-CST-004
informative_references:
  - 011_METHODOLOGY_REFERENCE_CATALOG.json
  - ../00_GAEP_Product_Strategy/004_POSITIONING_AND_ALTERNATIVES.md
supersedes: []
---

# Market Evidence and Benchmark Contract

## 1. Purpose and authority boundary

This contract defines the machine-checkable P02 decision foundation for market category, evaluated-product identity, evidence-bound capability comparison, GAEP maturity, executive claims, and enterprise adoption decisions. It is Proposed and not approved. It does not authorize publication, procurement, rollout, release, or use of a claim outside its declared context.

`GAEP-REG-013` is the single canonical P02 machine registry. `GAEP-STR-004` is its generated human projection. Product and market evidence belongs here; methodology and standards truth remains owned by `GAEP-REG-011` and `GAEP-REG-003`.

## 2. Separation of truth

| Truth | Canonical owner | P02 rule |
|---|---|---|
| Methodology/standard identity and mapping | `GAEP-REG-011` | consume by exact catalog/version binding; never copy into a Product identity |
| Reference evidence discipline | `GAEP-REG-003` | reuse evidence-state, rights, freshness, limitation, and claim-boundary semantics |
| Claim/evidence assurance | `GAEP-CORE-007` | preserve claim, evidence, review, approval, and authorization as separate states |
| Market/product evidence and benchmark | `GAEP-REG-013` | one canonical registry with deterministic projection |
| Human positioning and buyer guide | generated `GAEP-STR-004` | no independently edited market truth |

An evaluated subject that is a method is classified as `methodology-framework` or `research-deferred` and is not entered in the Product identity registry. A product is never added to the methodology catalog.

## 3. Evidence receipts and exact support assertions

Each external source has a stable evidence ID, exact HTTPS URI, publisher, source type, access and as-of dates, content-review state/depth, freshness trigger, next review, rights/citation state, review summary, blocked claims, limitations, supersession links, and access result. A source digest is present only when exact legally captured bytes exist. Missing access or review remains explicit and cannot support a benchmark cell.

An Evidence receipt is not itself a capability conclusion. Every reusable conclusion is a first-class `evidenceAssertion` with one exact subject, one exact capability where it is feature-bearing, a bounded proposition, assertion type, strength, polarity, delivery state, source locator, dates, limitations, ordering, status, and supersession. A Product overview can support several capabilities only through separate human-reviewed assertions. Identity-only Evidence cannot support a capability.

Vendor documentation supports only bounded statements about what that vendor documents. It does not prove product effectiveness, competitor absence, customer outcomes, superiority, security, compliance, or certification.

## 4. Product identity

Every evaluated product/project has one canonical identity containing steward, official URI, categories, lifecycle scope, deployment/hosting, licensing state when verified, evidence bindings, known unknowns, review date, and lifecycle status. Ambiguous Product Owner seed names are resolved in `seedResolutions`; an ambiguity may remain unresolved or may select one identity only with explicit rationale and evidence.

## 5. Capability taxonomy and cells

The taxonomy is stable and vendor-neutral. Every product has exactly one benchmark cell for every capability. Each cell carries:

- `supportLevel`: `verified-supported`, `partially-supported`, `unsupported-by-reviewed-evidence`, `unknown`, or `not-applicable`;
- exact support-assertion and availability-assertion IDs, as-of date, bounded rationale, and limitation;
- delivery state: shipped, preview/beta, announced roadmap, community extension, inference, or not assessed.

`verified-supported` requires an active verified positive assertion for the same Product and capability. `partially-supported` requires an active partial or bounded positive assertion. `unknown` carries no support conclusion and is never rendered as No. `unsupported-by-reviewed-evidence` requires a verified explicit-negative assertion; absence of documentation is insufficient. `shipped` requires a separate compatible official availability assertion and cannot be inferred from roadmap wording.

## 6. GAEP maturity

GAEP uses structured repository assertions at an exact commit. Each assertion binds one capability, exact repository paths, an observed proposition, evidence strength, maturity, limitations, and status. Each capability is separately classified as:

- `implemented-and-automated-tested`;
- `implemented-awaiting-product-owner-acceptance`;
- `candidate-proposed`;
- `partial`;
- `planned-deferred-coming-soon`;
- `unknown-not-assessed`.

These are implementation-observation states, not readiness or approval. A GAEP roadmap cell is never compared as delivered against a shipped vendor capability.

## 7. Executive claims

Every candidate statement has a stable ID, audience/context, exact wording, claim class, exact Product/capability scope, support-assertion and repository-assertion bindings, as-of date, disposition, qualifiers, freshness trigger, accountable owner role, and approval/publication state. A multi-Product comparison requires Product-specific support for every named Product. Allowed wording is bounded to reviewed evidence. The validator blocks unsupported superiority, ROI, time-saving, quality, security, compliance, certification, readiness, guarantee, and competitor-absence claims.

`allowed-internal` means usable only as internal decision support with its qualifiers. It is not public approval. `prohibited` blocks use. `pending-human-decision` records a hypothesis or decision gap.

## 8. Decision framework

Scenario views identify fit and non-fit conditions without a universal winner score. Any future weight or score must publish its rubric, preserve raw evidence and unknowns, show sensitivity, and never rank unsupported cells. Proof-of-value metrics require definition, baseline, observation window, data owner, confounders, and decision threshold; P02 does not invent target values.

## 9. Determinism and validation

The canonical command is `npm run test:market-benchmark`. It begins with validation of the actual `GAEP-REG-013` registry, then runs JSON Schema, semantic, hostile, parity, and projection-drift checks. Serialization is canonical: object fields follow the schema/serializer contract and arrays use their declared stable ordering.

Validation fails closed for duplicate/unknown IDs, wrong-Product or wrong-capability assertions, unavailable/identity-only/stale/superseded support, strength mismatch, missing shipped availability, missing cells, stale bindings, non-HTTPS official URIs, impossible chronology, conflicting states, noncanonical ordering/serialization, broken supersession, unsupported claims, status inflation, type confusion, orphan evidence/assertions, unauthorized approval/publication, invented ranking, unresolved seed ambiguity disguised as selection, cross-catalog duplicate truth, and stale projections.

## 10. Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-MKT-REQ-001 | Every external source SHALL satisfy the evidence receipt and HTTPS requirements. | Schema and semantic validation |
| GAEP-MKT-REQ-002 | Every evaluated Product SHALL resolve to exactly one Product identity or an explicit research-deferred record. | Identity coverage test |
| GAEP-MKT-REQ-003 | Every Product/capability pair SHALL have exactly one assertion-bound or explicitly unknown/not-applicable cell. | Matrix completeness test |
| GAEP-MKT-REQ-004 | Missing public evidence SHALL NOT become `unsupported-by-reviewed-evidence`. | Hostile absence test |
| GAEP-MKT-REQ-005 | Methodologies and Products SHALL remain in their owning registries. | Cross-catalog type-confusion test |
| GAEP-MKT-REQ-006 | GAEP maturity SHALL bind exact repository evidence and SHALL not imply Product Owner acceptance. | Maturity semantic test |
| GAEP-MKT-REQ-007 | Every factual or comparative executive claim SHALL bind sufficient exact Product/capability support assertions and applicable GAEP repository assertions. | Claim validator |
| GAEP-MKT-REQ-008 | Prohibited strong wording SHALL fail closed unless an exact separate authority is represented; P02 contains no such authority. | Hostile claim tests |
| GAEP-MKT-REQ-009 | Scenario views SHALL not create a total winner score or rank through unknown evidence. | Scenario semantic test |
| GAEP-MKT-REQ-010 | Generated human projections SHALL match exact registry ID, version, digest, and generated sections. | Projection parity test |
| GAEP-MKT-REQ-011 | Every seed SHALL have exactly one explicit resolution state and ambiguity rationale. | Seed saturation test |
| GAEP-MKT-REQ-012 | Approval and publication states SHALL remain not-approved/not-published in P02. | Authority-boundary test |
| GAEP-MKT-REQ-013 | Every non-Unknown benchmark conclusion SHALL bind an active, accessible, strength-compatible assertion for the exact Product and capability. | Relational assertion validator |
| GAEP-MKT-REQ-014 | Every shipped cell SHALL bind compatible official availability Evidence. | Delivery-state hostile tests |

## 11. P03 projection boundary

P03 may project the category model, taxonomy labels, support/maturity legends, scenario views, claim dispositions, evidence/limitation affordances, and freshness indicators from `GAEP-REG-013`. P03 must not copy or redefine those values, turn unknown into No, display roadmap as shipped, expose raw JSON as the primary experience, or imply approval/publication. P02 implements no P03 visual Guideline or Product Studio runtime UX.
