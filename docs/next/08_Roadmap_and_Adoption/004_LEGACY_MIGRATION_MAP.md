---
id: GAEP-RM-004
title: Legacy Draft Migration Map
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Current GAEP Draft corpus to GAEP Next candidate baseline
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - ../../000_READ_FIRST.md
supersedes: []
---

# Legacy Draft Migration Map

No legacy file is superseded by this map. Supersession requires approved exact versions, preserved history, migration consequences and an explicit baseline decision.

| Current Draft | Candidate disposition |
|---|---|
| `000_READ_FIRST.md` | Replace after approval with the candidate portal and role-based paths; reconcile its Product-as-Initiative navigation statement through `GAEP-DEC-007` |
| `01_Foundation/001_GAEP_CONSTITUTION.md` | Reduce to durable invariants in candidate Constitution; Product-as-Initiative versus Product-as-Managed-Asset remains a breaking decision under `GAEP-DEC-007` and `GAEP-GAP-050` |
| `01_Foundation/002_PROJECT_VISION.md` | Split into Product Charter, problem evidence and theory of change; reconcile Product-as-Initiative statements through `GAEP-DEC-007` |
| `01_Foundation/003_PLATFORM_PHILOSOPHY.md` | Consolidate durable content into Constitution and Principle Catalog |
| `01_Foundation/004_CORE_PRINCIPLES.md` | Consolidate without duplicate obligations into Principle Catalog; reconcile P06 Product-as-Initiative wording through `GAEP-DEC-007` |
| `01_Foundation/005_DESIGN_PRINCIPLES.md` | Move durable principles to catalog; realization guidance to relevant documents |
| `01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md` | Split into Scope/Work, Applicability, Profile and adoption content; preserve Initiative-neutrality intent while reconciling Product identity through `GAEP-DEC-007` |
| `02_Platform/010_PLATFORM_ARCHITECTURE.md` | Replace with bounded contexts plus Repository/Runtime realizations; reconcile Product Workspace as an Initiative Workspace specialization through `GAEP-DEC-007` |
| `02_Platform/011_REPOSITORY_PHILOSOPHY.md` | Move invariants to principles and mechanics to Repository Realization |
| `02_Platform/012_CONTEXT_ENGINEERING.md` | Consolidate into Capability/Workflow/Context Core and data/security profiles |
| `02_Platform/013_GOVERNANCE_MODEL.md` | Split into Identity/Authority, Policy/Risk and Decision/Authorization Core |
| `02_Platform/014_COMMAND_MODEL.md` | Normalize within Capability and Workflow Core |
| `02_Platform/015_SKILL_MODEL.md` | Normalize within Capability Core and Agent Adapter Conformance |
| `02_Platform/016_AGENT_MODEL.md` | Split into Identity/Authority, Capability, Execution and Adapter contracts |
| `02_Platform/017_RUNTIME_MODEL.md` | Replace with Execution Core and Runtime Realization |
| `02_Platform/018_STATE_MODEL.md` | Replace with orthogonal State/Event/Transition Core and profile statecharts; migrate Product-Initiative lifecycle states only through the decision-bound state-ownership mapping below |
| `02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md` | Split across Scope/Work, Applicability, Profile resolution and lifecycle profiles; do not silently convert legacy Product initiative type classifications into Managed Asset identities |
| `02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md` | Split into Claim/Evidence Core, Architecture Profile and Assurance Profile; reconcile Product-specific Initiative scope and roles through `GAEP-DEC-007` |
| `03_Product_Engineering/020_PACKAGE_STRATEGY.md` | Move package composition to Capability/Profile contracts and product packages to Product Profile; reconcile Product-initiative package activation through `GAEP-DEC-007` |
| `03_Product_Engineering/021_PRODUCT_LIFECYCLE.md` | Become Product Development Profile; separate durable Product identity from bounded Initiative work only after `GAEP-DEC-007`, with claims requiring evidence or hypothesis labels |
| `03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md` | Split into Governed Resource/Version, State and Retention semantics |
| `03_Product_Engineering/023_CHANGE_MANAGEMENT.md` | Split into Scope/Work, Decision/Authorization and Operational profiles |
| `03_Product_Engineering/024_TRACEABILITY_MODEL.md` | Replace with Trace/Provenance/Semantic Registry Core |
| `03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md` | Consolidate under Identity and Decision/Authorization Core |
| `04_Repository/030_REPOSITORY_STRUCTURE.md` | Become Repository Realization after authority/federation validation; map Product and Initiative workspace paths without treating either path as canonical identity |
| `04_Repository/031_CONTEXT_PACKS.md` | Split into Context Core, Repository Realization and profile rules |
| `04_Repository/032_KNOWLEDGE_MODEL.md` | Split into Trace/Provenance, Claim/Evidence and future learning profile |
| `04_Repository/033_ARTIFACT_MODEL.md` | Replace with Governed Resource and Version Core |
| `04_Repository/034_METADATA_MODEL.md` | Split into document metadata registry and governed-resource metadata contracts; reconcile separate `product` and `initiative` fields through `GAEP-DEC-007` |
| `04_Repository/035_NAMING_CONVENTIONS.md` | Replace with namespaced identity and controlled-registry conventions; map separate Product and Initiative IDs/folders without identity reuse |
| `05_AI_Runtime/040_CODEX_WORKING_MODEL.md` | Reduce to informative Codex delta plus evaluated adapter manifest later |
| `05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md` | Reduce to informative Claude delta plus evaluated adapter manifest later |
| `05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md` | Consolidate into Execution Core and Runtime Realization |
| `05_AI_Runtime/043_CONTEXT_LOADING.md` | Consolidate into Context Core and Runtime Realization |
| `05_AI_Runtime/044_DECISION_MODEL.md` | Consolidate into Decision/Authorization Core |
| `05_AI_Runtime/045_STOP_CONDITIONS.md` | Move to policy-driven execution requirements and profile rules |
| `06_Roadmap/050_PLATFORM_ROADMAP.md` | Replace with outcome-gated pre-implementation roadmap |
| `06_Roadmap/051_IMPLEMENTATION_STRATEGY.md` | Defer technology; retain only readiness and future slice-charter requirements; replace its Product-workspace upgrade assumption with the selected `GAEP-DEC-007` migration treatment |
| `06_Roadmap/052_ADOPTION_GUIDE.md` | Rebuild around first workflow, burden, behavior, support and trust |
| `06_Roadmap/053_FUTURE_EVOLUTION.md` | Retain extension points; move deferred capabilities out of Core commitments |
| `99_References/990_REFERENCES.md` | Rebuild as complete, versioned standards/reference crosswalk |
| `99_References/991_GLOSSARY.md` | Merge with terminology as human view of canonical registry; reconcile the Product-as-Initiative definition through `GAEP-DEC-007` |
| `99_References/992_TERMINOLOGY.md` | Become canonical terms registry with aliases and deprecation; version and migrate Product/Initiative terms through `GAEP-DEC-007` rather than silently replacing them |
| `99_References/993_EXTERNAL_PROJECTS.md` | Split into external mapping registry and alternatives assessment |

## Breaking semantic compatibility — Product and Initiative

This section is an informative migration analysis supporting the normative plan obligation in `GAEP-BASE-READY-REQ-010`; it is not a selected semantic outcome or an independently authoritative contract. The legacy corpus treats Product as an Engineering Initiative type. The candidate treats Product as a durable Managed Asset targeted by bounded Initiatives. The current candidate text assumes the latter, but `GAEP-DEC-007` remains unresolved and `GAEP-GAP-050` therefore blocks baseline approval.

### Affected source and candidate surfaces

| Concern | Legacy meaning | Candidate meaning | Disposition needed to satisfy `GAEP-BASE-READY-REQ-010` |
|---|---|---|---|
| Canonical Product identity | A Product is an Engineering Initiative type. | A Product is a Managed Asset type with identity independent of any Initiative. | Select an option through `GAEP-DEC-007`; bind exact source and target revisions; prohibit silent identity reuse. |
| Work identity and lifetime | Product work and Product identity may share one Initiative record and lifecycle. | An Initiative is bounded work that creates, changes, investigates, migrates, secures, or retires Managed Assets. | Decide whether each legacy record represents durable subject, bounded work, or both; preserve original identity and meaning in the mapping record. |
| Relationship and cardinality | Product classification identifies the Initiative; explicit durable-target cardinality is absent. | `targets` links an Initiative or Change to one or more Managed Assets; one Product may be targeted by many Initiatives. | Create explicit Product Managed Asset and Initiative identities where selected; record every `targets` relationship and unresolved cardinality. |
| Lifecycle and state ownership | Product lifecycle states attach to an Initiative classified as Product. | Product, Initiative, Change, Work Item, evidence, approval, validity, and operational concerns retain separate state dimensions or records. | Map each legacy state to the exact candidate subject and state dimension; return unresolved when no lossless mapping exists. |
| Profile applicability | Product classification selects Product lifecycle content. | Product Development Profile applies to an Initiative creating or materially evolving a Product Managed Asset. | Re-evaluate applicability against exact Initiative and Product identities; file presence or legacy classification is not automatic selection. |
| Baselines, schemas, and trace | Legacy fields and links may use one Product-Initiative identifier. | Candidate records use separate canonical identities, exact revisions, Scope References, and relationships. | Publish field-, identifier-, relationship-, query-, and trace-level mappings with loss, ambiguity, and consumer impact. |
| Historical interpretation | Readers infer Product and work history from one initiative-type model. | Readers distinguish enduring Product history from each bounded work history. | Preserve legacy records and their original semantics; derived candidate views must link back to the exact legacy revision and transformation method. |
| Compatibility and coexistence | Legacy consumers expect Product-as-Initiative. | Candidate consumers expect Product Managed Asset plus bounded Initiative. | Assess Core compatibility per dimension and revision; record mapping fidelity, representation strategy, and migration disposition separately; never advertise silent equivalence. |
| Rollback and recovery | Current Draft files remain the recoverable representation. | No Candidate Revision Set or Baseline Set exists yet. | Retain legacy corpus, reversible mapping output, rejected mappings, and recovery instructions until separately approved supersession and archival. |

### Minimum known clause and record reconciliation inventory

This inventory captures the currently identified direct dependencies. Candidate-baseline review still requires a full exact-revision corpus and consumer scan; omission from this table is not evidence that a clause, schema, adapter, query, or external consumer is unaffected.

| Source or candidate surface | Exact clause, record, or controlled value | Proposed reconciliation after a selected outcome |
|---|---|---|
| Legacy `GAEP-FND-001` | Article I — Mission: Product is an Engineering Initiative type. | Retain, amend, or supersede the exact constitutional clause through constitutional authority; record compatibility and effective time. |
| Legacy `GAEP-PLT-018` | State Dimensions and Product Lifecycle Profile States attach Product lifecycle state to an Initiative classified as Product. | Map every state and transition to Product Managed Asset, Initiative, both, or unresolved; preserve historical meaning and invalid transitions. |
| Legacy `GAEP-PLT-019` | Initiative classification and Applicability Engine use Product as an Initiative type that selects lifecycle content. | Reconcile classification, applicability input, profile selection, and multi-classification behavior without inferring identity equivalence. |
| Legacy `GAEP-PEN-021` | Purpose and lifecycle clauses govern Engineering Initiatives classified as Products. | Separate durable-Product obligations from bounded-work obligations, or retain the legacy model explicitly; map phases, approvals, release, operation, evolution, and retirement. |
| Legacy navigation and principle surfaces | `docs/000_READ_FIRST.md`; P06 in `GAEP-FND-004`; Product/generic-work clauses in `GAEP-FND-006`. | Reconcile navigation and durable Initiative-neutrality guidance without preserving a disputed identity claim as an implicit invariant. |
| Legacy terminology surfaces | Engineering Initiative definition in `GAEP-REF-991`; Engineering Initiative Versus Product and discouraged-term rows in `GAEP-REF-992`. | Preserve exact legacy definitions for historical interpretation; version the selected canonical term, aliases, deprecations, and replacement guidance. |
| Legacy Product/package/assurance surfaces | Product-as-Initiative statements in `GAEP-FND-002`; Product-specific scope guidance in `GAEP-PLT-020`; Product-initiative package activation in `GAEP-PEN-020`. | Re-evaluate Product strategy, assurance scope, role applicability, and package selection without carrying legacy identity assumptions into the chosen model. |
| Legacy workspace, schema, and migration surfaces | Product Workspace specialization in `GAEP-PLT-010`; Product/Initiative paths in `GAEP-REP-030`; separate metadata and IDs in `GAEP-REP-034`/`GAEP-REP-035`; upgrade rule in legacy Implementation Strategy 051. | Map paths, IDs, fields, queries, adapters, and upgrade behavior at record level; path or field presence cannot establish canonical Product/Initiative identity. |
| Candidate `GAEP-CORE-001` | Entity and relationship definitions; Product/cardinality/lifetime negative cases; and `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-004`, `GAEP-SCOPE-REQ-017`, `GAEP-SCOPE-REQ-018`, `GAEP-SCOPE-REQ-020`, `GAEP-SCOPE-REQ-023`, and `GAEP-SCOPE-REQ-024`. | Retain or revise identity independence, Initiative targets, Product typing, closure/retirement behavior, conformance scope, non-collapse, and canonical references as one coherent contract. |
| Candidate `GAEP-CORE-004` and `GAEP-REG-007` | `GAEP-STATE-REQ-001`, `GAEP-STATE-REQ-002`, `GAEP-STATE-REQ-003`, `GAEP-STATE-REQ-016`, `GAEP-STATE-REQ-021`, `GAEP-STATE-REQ-022`, and `GAEP-STATE-REQ-023`; plus `GAEP-STATE-REG-REQ-001`, `GAEP-STATE-REG-REQ-002`, `GAEP-STATE-REG-REQ-005`, and `GAEP-STATE-REG-REQ-007`. | Map every legacy Product lifecycle value to one named subject and semantic dimension, preserve composite inputs and uncertainty, and version any Profile-specific statechart rather than normalizing similar labels. |
| Candidate `GAEP-CORE-012` | Compatibility dimensions/results plus `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-012`, `GAEP-ECF-REQ-013`, `GAEP-ECF-REQ-014`, `GAEP-ECF-REQ-015`, `GAEP-ECF-REQ-016`, and `GAEP-ECF-REQ-017`. | Bind compatibility to exact revisions and dimensions; keep unknown explicit; preserve identity, provenance, decisions, approvals, evidence, and authority or declare translation loss. |
| Candidate `GAEP-PROF-001` | Applicability and Profile contract plus `GAEP-PROD-REQ-001`, `GAEP-PROD-REQ-005`, `GAEP-PROD-REQ-007`, `GAEP-PROD-REQ-009`, `GAEP-PROD-REQ-011`, and `GAEP-PROD-REQ-012`. | Reconcile Product/Initiative subject references, baselines, lifecycle duties, selection, conformance, and Profile migration against the selected Core meaning. |
| Candidate `GAEP-STR-002` | Product and non-product evidence case uses a bounded Initiative targeting a Product Managed Asset. | Retain or revise the comparison design so evidence does not preselect the disputed ontology and still tests materially different Product/non-Product cases. |
| Candidate `GAEP-REG-005` and `GAEP-REG-006` | `Managed Asset`, `Initiative`, ambiguous-term replacement for `Product Initiative`, and relationship value `gaep.rel.targets`. | Version, retain, revise, alias, or deprecate each controlled value; document domain, range, cardinality, inverse, loss, and compatibility. |
| Candidate `GAEP-SELF-001`, `GAEP-SELF-002`, and `GAEP-SELF-003` | Self-scope Managed Asset/Initiative bindings, unresolved Product Profile selection, and `GAEP-DEC-007`. | Rebind exact self-workspace identities and applicability only after the decision; preserve unresolved authority and Profile state rather than inferring effectiveness. |
| Candidate machine schemas, adapters, queries, and external consumers | No canonical Product/Initiative entity schema or complete consumer inventory is selected in the candidate. | Record absence explicitly, then identify every introduced field, identifier, constraint, query, adapter, and external contract before claiming migration completeness. |
| Candidate `GAEP-RM-004` and `GAEP-RM-006` | This migration analysis and `GAEP-BASE-READY-REQ-010`. | Bind the selected Decision Record, exact revisions/digests, dimension-specific compatibility results, rehearsal evidence, rollback, and Approval Determination to the Candidate Revision Set. |

### Record-level transformation rule

`GAEP-BASE-READY-REQ-010` requires the migration plan to address identity and state transformation. To support that requirement, this candidate record shape treats mechanical rename as insufficient and proposes identifying:

- exact legacy Resource Revision or qualified digest and original Product-Initiative identifier;
- whether the source represents a durable Product, bounded work, or an inseparable combination;
- proposed Product Managed Asset identity, or an explicit retained-legacy/not-applicable disposition, plus zero or more bounded Initiative identities;
- exact `targets`, predecessor, successor, representation, and historical-alias relationships;
- lifecycle/state mapping with omissions, splits, merges, unsupported values, and uncertainty;
- affected Profiles, baselines, schemas, queries, links, claims, decisions, approvals, and external consumers;
- transformation method, actor, evidence, validation, loss assessment, rollback, and invalidation triggers;
- unresolved conflicts requiring human decision rather than inferred defaults.

### Proposed migration assessment fields

The assessment should not compress assessment coverage, compatibility, mapping fidelity, representation strategy, applicability, and migration decision into one status. `GAEP-STATE-REG-REQ-001`, `GAEP-STATE-REG-REQ-005`, and `GAEP-STATE-REG-REQ-007` keep these meanings separate.

| Field | Proposed representation | Boundary |
|---|---|---|
| Assessment coverage | exact source/target revisions, dimensions assessed, evaluator, method, evidence, time, and unassessed dimensions | Absence of assessment is not incompatibility, compatibility, deferral, or non-applicability. |
| Compatibility result | use `compatible`, `compatible-with-conditions`, `incompatible`, `unknown`, or `not-applicable` separately for every applicable `GAEP-CORE-012` dimension | No aggregate label may hide a failed or unknown material dimension. |
| Mapping fidelity and loss | `not-mapped`, `lossless`, `lossy`, or `unknown`, plus omitted fields, semantics, relationships, states, authority, and consumer consequences | Mapping fidelity is not a compatibility, approval, or migration-decision result. These values remain Proposed until placed in an approved registry. |
| Representation and coexistence | reference the exact cutover, versioned-mapping/dual-read, persistent-dual, or no-authoritative-migration treatment evaluated under `GAEP-DEC-007` | Representation strategy does not select the ontology or authorize migration. |
| Migration decision and permission | reference exact Decision Outcome, Approval Determination, migration subject/plan revision, and Authorization Grant where effectful | `deferred`, `no action`, approval, and authorization remain separate governed records, not compatibility values. |
| Applicability | record the exact source-target pair and dimension for any `not-applicable` result, with rationale | Non-applicability in one dimension does not propagate to another dimension or the migration as a whole. |

Bounded read-only or explicitly reversible rehearsal may produce decision evidence before `GAEP-DEC-007` is resolved, provided it preserves source authority, labels outputs non-authoritative, records loss and uncertainty, and claims no migration or supersession. Any authoritative or effectful transformation remains blocked until `GAEP-DEC-007` has a valid Decision Outcome, the exact migration subject and plan are approved, and the repository change has a separate applicable Authorization Grant.

## Migration gates

1. Candidate content and ownership review.
2. Contradiction and semantic-registry closure, including `GAEP-DEC-007` and `GAEP-GAP-050`.
3. Reference-scenario and manual-pilot evidence.
4. Metadata, dependency, link and requirement validation.
5. Exact-version approval and named baseline set.
6. Supersession records and redirects.
7. Legacy archival or removal only through a separately approved, recoverable change.
