---
id: GAEP-RM-004
title: Legacy Draft Migration Map
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Current GAEP Draft corpus to the Proposed GAEP Next candidate corpus; no Candidate Revision Set or Baseline Set is designated
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
  - ../02_Core_Specification/001_SCOPE_AND_WORK_MODEL.md
  - ../02_Core_Specification/004_STATE_EVENT_AND_TRANSITION_MODEL.md
  - ../02_Core_Specification/012_EXTENSION_COMPATIBILITY_AND_FEDERATION_MODEL.md
  - ../03_Profiles/001_PRODUCT_DEVELOPMENT_PROFILE.md
  - ../06_GAEP_On_GAEP/003_DECISION_REGISTER.md
  - ../06_GAEP_On_GAEP/012_REPOSITORY_GAP_REGISTER.md
  - 006_CANDIDATE_BASELINE_APPROVAL_GATE.md
  - ../99_Registries_and_References/005_CANONICAL_TERMINOLOGY_INDEX.md
  - ../99_Registries_and_References/006_CANDIDATE_RELATIONSHIP_REGISTRY.md
  - ../99_Registries_and_References/007_CANDIDATE_STATE_DIMENSION_REGISTRY.md
supersedes: []
---

# Legacy Draft Migration Map

No legacy file is superseded by this map. The selected intent is to prepare a version-bound supersession package, but supersession requires exact source and replacement revisions, preserved history, migration and compatibility consequences, constitutional authority, a version-bound Approval Determination, and any separately required authorized Change. A Git commit, mapping, metadata label, Decision Outcome, or baseline proposal is not supersession by itself.

| Current Draft | Candidate disposition |
|---|---|
| `000_READ_FIRST.md` | Preserve unchanged for historical interpretation; prepare a redirect to the candidate portal only for a separately approved and authorized supersession Change; map its Product-as-Initiative navigation statement under selected Option B |
| `GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md` | Preserve as an informative, shareable Product-identity synthesis; it does not supersede the Constitution, activate the Product Development Profile, designate a Candidate Revision Set, claim implementation completeness, or grant distribution rights; reconcile future revisions with approved Product Strategy, controlled terminology, capability truth, and lifecycle-profile decisions |
| `01_Foundation/001_GAEP_CONSTITUTION.md` | Preserve unchanged; prepare an exact version-bound constitutional supersession package mapping Product-as-Initiative to selected Product-as-Managed-Asset semantics without claiming constitutional approval |
| `01_Foundation/002_PROJECT_VISION.md` | Preserve unchanged; map Product-as-Initiative statements to Product Charter, problem evidence, and theory-of-change candidate surfaces under selected Option B |
| `01_Foundation/003_PLATFORM_PHILOSOPHY.md` | Consolidate durable content into Constitution and Principle Catalog |
| `01_Foundation/004_CORE_PRINCIPLES.md` | Preserve unchanged; map P06's durable Initiative-neutrality intent while replacing its Product-as-Initiative identity assumption only through later approved supersession |
| `01_Foundation/005_DESIGN_PRINCIPLES.md` | Move durable principles to catalog; realization guidance to relevant documents |
| `01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md` | Preserve unchanged; map Scope/Work, Applicability, Profile, and adoption content while retaining Initiative-neutrality and separating Product identity under selected Option B |
| `02_Platform/010_PLATFORM_ARCHITECTURE.md` | Preserve unchanged; map bounded contexts plus Repository/Runtime realizations and treat Product Workspace specialization as representation guidance, not Product/Initiative identity equivalence |
| `02_Platform/011_REPOSITORY_PHILOSOPHY.md` | Move invariants to principles and mechanics to Repository Realization |
| `02_Platform/012_CONTEXT_ENGINEERING.md` | Consolidate into Capability/Workflow/Context Core and data/security profiles |
| `02_Platform/013_GOVERNANCE_MODEL.md` | Split into Identity/Authority, Policy/Risk and Decision/Authorization Core |
| `02_Platform/014_COMMAND_MODEL.md` | Normalize within Capability and Workflow Core |
| `02_Platform/015_SKILL_MODEL.md` | Normalize within Capability Core and Agent Adapter Conformance |
| `02_Platform/016_AGENT_MODEL.md` | Split into Identity/Authority, Capability, Execution and Adapter contracts |
| `02_Platform/017_RUNTIME_MODEL.md` | Replace with Execution Core and Runtime Realization |
| `02_Platform/018_STATE_MODEL.md` | Preserve unchanged; map to orthogonal State/Event/Transition Core and Profile statecharts, allocating legacy Product-Initiative lifecycle states only through the state-ownership rules below |
| `02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md` | Preserve unchanged; map Scope/Work, Applicability, Profile resolution, and lifecycle content without silently converting legacy Product initiative-type classifications into Managed Asset identities |
| `02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md` | Split into Claim/Evidence Core, Architecture Profile and Assurance Profile; reconcile Product-specific Initiative scope and roles through `GAEP-DEC-007` |
| `03_Product_Engineering/020_PACKAGE_STRATEGY.md` | Move package composition to Capability/Profile contracts and product packages to Product Profile; reconcile Product-initiative package activation through `GAEP-DEC-007` |
| `03_Product_Engineering/021_PRODUCT_LIFECYCLE.md` | Preserve unchanged; map durable-Product obligations to Product Managed Asset semantics and bounded-work obligations to Initiative semantics, with Profile applicability still unresolved and inactive |
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
| `06_Roadmap/051_IMPLEMENTATION_STRATEGY.md` | Preserve unchanged; defer technology, retain only readiness and future slice-charter inputs, and replace its lossless Product-workspace upgrade assumption in candidate planning with staged dual-read, explicit loss, and unresolved-mapping behavior |
| `06_Roadmap/052_ADOPTION_GUIDE.md` | Rebuild around first workflow, burden, behavior, support and trust |
| `06_Roadmap/053_FUTURE_EVOLUTION.md` | Retain extension points; move deferred capabilities out of Core commitments |
| `06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md` | Preserve as an informative implementation inventory and planning aid; reconcile statuses against current repository evidence, but do not treat a tracker status as semantic approval, Candidate Revision Set membership, baseline designation, conformance evidence, or release authority |
| `06_Roadmap/055_GAEP_CONTINUOUS_IMPLEMENTATION_CONTROL.md` | Preserve as an operational progress and interruption-recovery ledger for the separately authorized local implementation activity; it records execution state and evidence but does not amend this candidate, resolve its Decisions, assign GAEP authority, approve a baseline, or authorize release or deployment |
| `06_Roadmap/056_GAEP_ADAPTIVE_PRODUCT_JOURNEY_UX.md` | Preserve as an informative UX decision record for the separately authorized VS Code Product Journey work; it adopts benchmark interaction patterns but does not replace structured `.gaep` records, amend this candidate, approve a workflow, designate a baseline, or grant source, implementation, release, or deployment authority |
| `06_Roadmap/057_P00_BASELINE_AND_CURRENT_STATE_AUDIT.md` | Preserve as time-bound repository, implementation, test, package, installation, and risk evidence for the separately authorized P00 baseline exercise; it does not amend this candidate, resolve Product or Core Decisions, designate a Candidate Revision Set or baseline, establish conformance, accept Product behavior, or authorize implementation, release, or deployment |
| `99_References/990_REFERENCES.md` | Preserve as historical input; P01 projects its verified subset into canonical machine catalog `GAEP-REG-011`, schema and validator, human crosswalk `GAEP-REG-002`, and entry/claim contract `GAEP-REG-003` without upgrading the legacy file or unassessed bibliography entries |
| `99_References/991_GLOSSARY.md` | Preserve unchanged for historical interpretation; map its Product-as-Initiative definition to versioned candidate terminology without silent replacement |
| `99_References/992_TERMINOLOGY.md` | Preserve unchanged for historical interpretation; version Product/Initiative aliases, deprecations, and replacement guidance without reusing one identity for both meanings |
| `99_References/993_EXTERNAL_PROJECTS.md` | Preserve as historical input; P02 moves current Product/market evidence and relationship classification into `GAEP-REG-013`, retains methodology truth in `GAEP-REG-011`, and generates `GAEP-STR-004` as the only current human benchmark projection |

## Selected decision and revision boundary

The following values bind this Proposed migration analysis without creating a migration Decision, Candidate Revision Set, Baseline Set, Approval Determination, or Authorization Grant.

| Dimension | Current value | Consequence |
|---|---|---|
| Semantic option | `GAEP-DEC-007` Option B | Product is a long-lived Managed Asset; Initiative is bounded governed work affecting one or more Managed Assets. |
| Decision Outcome | `option-selected` | Human selection is recorded, but it does not approve or authorize migration. |
| Decision effectiveness | `pending` | Applicable canonical Role Assignments have not been created and explicitly accepted. |
| Compatibility treatment | versioned mapping with staged dual-read | Representation strategy is separate from compatibility result, mapping fidelity, migration status, approval, and authorization. |
| Initial write model | no dual-write | No legacy/candidate write synchronization, conflict policy, or write authority is approved. |
| Constitutional intent | version-bound supersession | The legacy Constitution remains unchanged and effective only according to its existing status until a separate constitutional Decision and Approval Determination exists. |
| Legacy source Git snapshot | `29312cf841c9c462431cfc64ea38a49eb3e9a0e5` | This identifies the observed source-tree content; it is not a formal Baseline Set designation. |
| Starting candidate Git revision | `00fabc5f1a208010376ffdb40189b65135fae17f` | This identifies the pre-Batch 1 candidate subject, not the changed candidate replacement revision. |
| Stabilized candidate replacement revision | not created | Exact post-change content digests or a later Git revision are required before version-bound review. |
| Formal Candidate Revision Set | not created | This map does not designate one. |
| Formal Baseline Set | not designated | No source or target corpus gains baseline authority from this analysis. |
| Constitutional Approval Determination | not issued | Supersession is not effective. |
| Migration Decision and Authorization | not issued | Only non-authoritative paper and reversible rehearsal evidence may be prepared. |

## Initial staged dual-read contract

The selected compatibility treatment has these initial constraints:

1. Legacy consumers continue to read unchanged legacy records under their original Product-as-Initiative semantics.
2. Candidate consumers may read only an explicitly versioned mapping or derived view whose source revision, transformation, mapping fidelity, ambiguity, and loss are visible.
3. Candidate semantics become canonical only for explicitly versioned new consumers after the required approval; this Proposed map does not make them canonical.
4. A derived Product or Initiative identity never silently replaces, reuses, or becomes equivalent to a legacy Product-Initiative identity.
5. Historical reconstruction retains the exact legacy content, source identifier, source revision, transformation record, and rejected or superseded mapping attempts.
6. No candidate projection writes back to a legacy source, and no process writes authoritatively to both representations during the initial phase.
7. Any future dual-write proposal requires a separate Decision Outcome defining single-record authority, conflict detection, synchronization ordering, failure and retry behavior, reconciliation, rollback, responsible roles, and exact authorization.
8. Ending dual-read requires explicit consumer inventory, deprecation criteria, historical-access proof, rollback evidence, and separately approved supersession; elapsed time or adoption alone is insufficient.

## Breaking semantic compatibility — Product and Initiative

This section is an informative migration analysis supporting the normative plan obligation in `GAEP-BASE-READY-REQ-010`; it is not an independently authoritative migration contract. The legacy corpus treats Product as an Engineering Initiative type. `GAEP-DEC-007` selects Product as a durable Managed Asset targeted by bounded Initiatives, but decision effectiveness, exact target binding, independent review, constitutional approval, compatibility evidence, and authoritative migration remain incomplete. `GAEP-GAP-050` therefore remains an open baseline blocker.

### Affected source and candidate surfaces

| Concern | Legacy meaning | Candidate meaning | Disposition needed to satisfy `GAEP-BASE-READY-REQ-010` |
|---|---|---|---|
| Canonical Product identity | A Product is an Engineering Initiative type. | A Product is a Managed Asset type with identity independent of any Initiative. | Apply selected Option B to the candidate; bind exact source and stabilized target revisions; prohibit silent identity reuse; retain pending effectiveness and constitutional approval. |
| Work identity and lifetime | Product work and Product identity may share one Initiative record and lifecycle. | An Initiative is bounded work that creates, changes, investigates, migrates, secures, operates, or retires Managed Assets. | Determine whether each legacy record represents a durable Product, bounded work, both, or neither; preserve original identity and meaning in the mapping record. |
| Relationship and cardinality | Product classification identifies the Initiative; explicit durable-target cardinality is absent. | `targets` links an Initiative or Change to one or more Managed Assets; one Product may be targeted by many Initiatives. | Create explicit Product Managed Asset and Initiative identities where selected; record every `targets` relationship and unresolved cardinality. |
| Lifecycle and state ownership | Product lifecycle states attach to an Initiative classified as Product. | Product, Initiative, Change, Work Item, evidence, approval, validity, and operational concerns retain separate state dimensions or records. | Map each legacy state to the exact candidate subject and state dimension; return unresolved when no lossless mapping exists. |
| Profile applicability | Product classification selects Product lifecycle content. | Product Development Profile applies to an Initiative creating or materially evolving a Product Managed Asset. | Re-evaluate applicability against exact Initiative and Product identities; file presence or legacy classification is not automatic selection. |
| Baselines, schemas, and trace | Legacy semantics may combine Product and Initiative even though some metadata and repository guidance already provide separate `product` and `initiative` IDs and paths. | Candidate records require separate canonical identities, exact revisions, Scope References, and relationships. | Classify each representation variant; publish field-, identifier-, relationship-, query-, and trace-level mappings with loss, ambiguity, and consumer impact. |
| Historical interpretation | Readers infer Product and work history from one initiative-type model. | Readers distinguish enduring Product history from each bounded work history. | Preserve legacy records and their original semantics; derived candidate views must link back to the exact legacy revision and transformation method. |
| Compatibility and coexistence | Legacy consumers expect Product-as-Initiative. | Candidate consumers expect Product Managed Asset plus bounded Initiative. | Use staged dual-read without dual-write; assess Core compatibility per dimension and revision; record mapping fidelity and migration disposition separately; never advertise silent equivalence. |
| Rollback and recovery | Current Draft files remain the recoverable representation. | No Candidate Revision Set or Baseline Set exists yet. | Retain legacy corpus, reversible mapping output, rejected mappings, and recovery instructions until separately approved supersession and archival. |

### Legacy representation variants

The legacy corpus is semantically inconsistent enough that no universal mechanical split is safe. It defines Product as an Initiative type while also exposing separate Product and Initiative identifiers and physical paths in some representations.

| Variant | Evidence pattern | Required treatment |
|---|---|---|
| Combined semantic identity | Product is represented only as an Initiative classification or one Product-Initiative record and lifecycle. | Preserve the original record; assess whether it can support one Product plus one or more bounded Initiatives without invented history. |
| Distinct identifiers under legacy semantics | A record contains both `initiative` and `product`, or links an Initiative to a separately identified Product. | Preserve both identifiers; verify their historic relationship rather than assuming equivalence or manufacturing a new split. |
| Distinct workspace paths | `products/<product-id>/` and `initiatives/<initiative-id>/` both exist, while Product Workspace is described as an Initiative Workspace specialization. | Treat paths as representations, not canonical identity or type evidence; map each path and referenced subject separately. |
| Product lifecycle on Initiative | Product operational, evolving, and retired values are attached to an Initiative classified as Product. | Allocate durable-subject state to Product and bounded-work state to Initiative only when clause- or record-level evidence supports the allocation. |
| Ambiguous or incomplete representation | Identifier, cardinality, state owner, or historical relationship cannot be established. | Record `unresolved`; do not infer, write, supersede, or advertise lossless compatibility. |

### Exact legacy source binding inventory

The current direct-source inventory is bound to observed legacy Git snapshot `29312cf841c9c462431cfc64ea38a49eb3e9a0e5`. The listed files are content-identical in the starting candidate revision `00fabc5f1a208010376ffdb40189b65135fae17f`. File SHA-256 values bind content more durably than a moving branch name. Line references aid review but are not identity.

| Document | Exact clause or record | File SHA-256 |
|---|---|---|
| `docs/000_READ_FIRST.md` (`GAEP-DOC-000`) | “What GAEP Is,” line 17: Engineering Initiative may be a Product. | `5db9e77a1f19efe227a09c339291dc6e69a28f53987c968f12d512a5e0ac6251` |
| `docs/01_Foundation/001_GAEP_CONSTITUTION.md` (`GAEP-FND-001`) | Article I — Mission, line 20: Product is an Engineering Initiative type. Exact clause SHA-256: `8e21642e796671e5ef7f6596cec0378e93765ee77f904a6e3793393c05fdee4a`. | `a2e56b654ba4740d25670628201b0efd1c2f7fc08009a63c5b57e970b03225e0` |
| `docs/01_Foundation/002_PROJECT_VISION.md` (`GAEP-FND-002`) | “An Initiative-Neutral Future,” lines 35–39; “Continuous Evolution,” line 135. | `78c2a84bfb6c68c15bdae7d3f7abde3ebf87e90484339d2d82243b6ef744d1d9` |
| `docs/01_Foundation/004_CORE_PRINCIPLES.md` (`GAEP-FND-004`) | P06 — Initiative Neutrality and Conditional Lifecycle, line 45. | `4c708a3c3807f0680810378c42995384208a5c95bb83bfa4aff38529719d7272` |
| `docs/01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md` (`GAEP-FND-006`) | Product/generic-work rules at lines 19, 39–60, and 110. | `a62be09bae443b440f201be32906138a4ade7232bc87c5b77985430c2a7ee482` |
| `docs/02_Platform/010_PLATFORM_ARCHITECTURE.md` (`GAEP-PLT-010`) | Primary Domain Concepts, lines 163–164: Product Workspace specializes Initiative Workspace. | `28f8fac12dd0e1093273583b3febcefa5c17edfd379b0d7fd0b4df1bd48c7d98` |
| `docs/02_Platform/018_STATE_MODEL.md` (`GAEP-PLT-018`) | State Dimensions line 17 and Product Lifecycle Profile States lines 43–66. | `ab81299f43d4a041b15d1c0812e05ade86b6e3ba187944e9ffa00533b7b61ea9` |
| `docs/02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md` (`GAEP-PLT-019`) | Initiative Classification and Applicability Engine, lines 103–137. | `b3e78005d0fe36f9c0d4e974d6f71cdbddb7fd247d897813c9ff2bf9d55995ce` |
| `docs/02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md` (`GAEP-PLT-020`) | Product/Initiative interpretation rule, line 852. | `a9b11d4a4eb587001fe4f021497b24ba7be96eb2c2d0cc2254745332e61a56bf` |
| `docs/03_Product_Engineering/020_PACKAGE_STRATEGY.md` (`GAEP-PEN-020`) | Package activation lines 81–91 and Package Instance lines 185–197. | `9862871665c2281fb1ede47b0253b2c1a0686260eae40c33f56c1adad5443279` |
| `docs/03_Product_Engineering/021_PRODUCT_LIFECYCLE.md` (`GAEP-PEN-021`) | Purpose lines 11–13, Stage 0 lines 41–60, and “Relationship to Other Initiative Lifecycles” line 382. | `836573da084b55ebe59481069f8a6809d59484220dc81e9308f53050de2d0f3d` |
| `docs/04_Repository/030_REPOSITORY_STRUCTURE.md` (`GAEP-REP-030`) | Product and Initiative Workspace sections, lines 105–188. | `11985a47ffb83afaedf038665c62a467d52ca4f257e17864b1096e09ee47885a` |
| `docs/04_Repository/034_METADATA_MODEL.md` (`GAEP-REP-034`) | Identity fields lines 30–37 and example `initiative`/`product` IDs lines 120–126. | `dd3fb42ae21cacd29614d948ebf4a0fc197f9d09b4f70eb34e2a7807dafce33f` |
| `docs/04_Repository/035_NAMING_CONVENTIONS.md` (`GAEP-REP-035`) | Initiative/Product identifiers lines 40–51 and breaking semantic change rule line 209. | `e8684f88da0bfa4453645d0a3d21636aed77aa0b2219a8f100d562cddbffdcf9` |
| `docs/06_Roadmap/051_IMPLEMENTATION_STRATEGY.md` (`GAEP-RDM-051`) | Product-specialized registry line 49 and lossless-upgrade assumption line 182. | `9a18005e6a886825afa89fe391e9c93236ca968f4d4e103398f2291819b4cb4b` |
| `docs/99_References/991_GLOSSARY.md` (`GAEP-REF-991`) | Lifecycle lines 62–63, Product Workspace line 71, and Engineering Initiative line 99. | `63c1645b326204380bfb204f41d6f0ee11dffbdc757eea8ef18fb9e2f6d05cf0` |
| `docs/99_References/992_TERMINOLOGY.md` (`GAEP-REF-992`) | “Engineering Initiative Versus Product,” lines 60–65, and discouraged generic Product usage line 208. | `8a5998c9cefc27a3e09288897c889b40b0cfd316dbb0214c79a468429b2d2c3a` |

This inventory is a minimum known direct set, not proof that every affected legacy clause, schema, query, adapter, or consumer has been found. The post-Batch 1 candidate target must be bound separately after its content stabilizes; reusing the starting commit as the target is prohibited.

### Minimum known clause and record reconciliation inventory

This inventory captures the currently identified direct dependencies. Candidate-baseline review still requires a full exact-revision corpus and consumer scan; omission from this table is not evidence that a clause, schema, adapter, query, or external consumer is unaffected.

| Source or candidate surface | Exact clause, record, or controlled value | Proposed reconciliation after a selected outcome |
|---|---|---|
| Legacy `GAEP-FND-001` | Article I — Mission: Product is an Engineering Initiative type. | Preserve the clause unchanged and prepare exact version-bound supersession to the selected Option B replacement; require constitutional authority, compatibility, transition, effective time, and Approval Determination before effect. |
| Legacy `GAEP-PLT-018` | State Dimensions and Product Lifecycle Profile States attach Product lifecycle state to an Initiative classified as Product. | Map every state and transition to Product Managed Asset, Initiative, both, or unresolved; preserve historical meaning and invalid transitions. |
| Legacy `GAEP-PLT-019` | Initiative classification and Applicability Engine use Product as an Initiative type that selects lifecycle content. | Reconcile classification, applicability input, profile selection, and multi-classification behavior without inferring identity equivalence. |
| Legacy `GAEP-PEN-021` | Purpose and lifecycle clauses govern Engineering Initiatives classified as Products. | Separate durable-Product obligations from bounded-work obligations under selected Option B; map phases, approvals, release, operation, evolution, and retirement without activating the Product Profile. |
| Legacy navigation and principle surfaces | `docs/000_READ_FIRST.md`; P06 in `GAEP-FND-004`; Product/generic-work clauses in `GAEP-FND-006`. | Reconcile navigation and durable Initiative-neutrality guidance without preserving a disputed identity claim as an implicit invariant. |
| Legacy terminology surfaces | Engineering Initiative definition in `GAEP-REF-991`; Engineering Initiative Versus Product and discouraged-term rows in `GAEP-REF-992`. | Preserve exact legacy definitions for historical interpretation; version the selected canonical term, aliases, deprecations, and replacement guidance. |
| Legacy Product/package/assurance surfaces | Product-as-Initiative statements in `GAEP-FND-002`; Product-specific scope guidance in `GAEP-PLT-020`; Product-initiative package activation in `GAEP-PEN-020`. | Re-evaluate Product strategy, assurance scope, role applicability, and package selection without carrying legacy identity assumptions into the chosen model. |
| Legacy workspace, schema, and migration surfaces | Product Workspace specialization in `GAEP-PLT-010`; Product/Initiative paths in `GAEP-REP-030`; separate metadata and IDs in `GAEP-REP-034`/`GAEP-REP-035`; upgrade rule in legacy Implementation Strategy 051. | Map paths, IDs, fields, queries, adapters, and upgrade behavior at record level; path or field presence cannot establish canonical Product/Initiative identity. |
| Candidate `GAEP-CORE-001` | Entity and relationship definitions; Product/cardinality/lifetime negative cases; and `GAEP-SCOPE-REQ-002`, `GAEP-SCOPE-REQ-003`, `GAEP-SCOPE-REQ-004`, `GAEP-SCOPE-REQ-017`, `GAEP-SCOPE-REQ-018`, and `GAEP-SCOPE-REQ-024`. | Retain or revise identity independence, Initiative targets, Product typing, closure/retirement behavior, exact scope, non-collapse, and canonical references as one coherent contract. |
| Candidate `GAEP-CORE-004` and `GAEP-REG-007` | `GAEP-STATE-REQ-001`, `GAEP-STATE-REQ-002`, `GAEP-STATE-REQ-003`, `GAEP-STATE-REQ-016`, `GAEP-STATE-REQ-021`, and `GAEP-STATE-REQ-023`; plus `GAEP-STATE-REG-REQ-001`, `GAEP-STATE-REG-REQ-002`, `GAEP-STATE-REG-REQ-005`, and `GAEP-STATE-REG-REQ-007`. | Map every legacy Product lifecycle value to one named subject and semantic dimension, preserve composite inputs and uncertainty, and version any Profile-specific statechart rather than normalizing similar labels. |
| Candidate `GAEP-CORE-012` | Compatibility dimensions/results plus `GAEP-ECF-REQ-011`, `GAEP-ECF-REQ-012`, `GAEP-ECF-REQ-013`, `GAEP-ECF-REQ-014`, `GAEP-ECF-REQ-015`, `GAEP-ECF-REQ-016`, and `GAEP-ECF-REQ-017`. | Bind compatibility to exact revisions and dimensions; keep unknown explicit; preserve identity, provenance, decisions, approvals, evidence, and authority or declare translation loss. |
| Candidate `GAEP-PROF-001` | Applicability and Profile contract plus `GAEP-PROD-REQ-001`, `GAEP-PROD-REQ-005`, `GAEP-PROD-REQ-007`, `GAEP-PROD-REQ-009`, `GAEP-PROD-REQ-011`, and `GAEP-PROD-REQ-012`. | Reconcile Product/Initiative subject references, baselines, lifecycle duties, selection, conformance, and Profile migration against the selected Core meaning. |
| Candidate `GAEP-STR-002` | Product and non-product evidence case uses a bounded Initiative targeting a Product Managed Asset. | Retain the selected ontology as an explicit scenario premise while ensuring evidence still tests materially different Product/non-Product cases and does not claim operational validation. |
| Candidate `GAEP-REG-005` and `GAEP-REG-006` | `Managed Asset`, `Initiative`, ambiguous-term replacement for `Product Initiative`, and relationship value `gaep.rel.targets`. | Version, retain, revise, alias, or deprecate each controlled value; document domain, range, cardinality, inverse, loss, and compatibility. |
| Candidate `GAEP-SELF-001`, `GAEP-SELF-002`, and `GAEP-SELF-003` | Self-scope Managed Asset/Initiative bindings, unresolved Product Profile selection, and `GAEP-DEC-007`. | Rebind exact self-workspace identities only after target revisions and effective assignments exist; preserve unresolved Profile selection and pending decision effectiveness rather than inferring either. |
| Candidate machine schemas, adapters, queries, and external consumers | No canonical Product/Initiative entity schema or complete consumer inventory is selected in the candidate. | Record absence explicitly, then identify every introduced field, identifier, constraint, query, adapter, and external contract before claiming migration completeness. |
| Candidate `GAEP-RM-004` and `GAEP-RM-006` | This migration analysis and `GAEP-BASE-READY-REQ-010`. | Bind the selected Decision Record, stabilized target revisions/digests, dimension-specific compatibility results, rehearsal evidence, rollback, and later Approval Determination to a separately created Candidate Revision Set. |

### Record-level transformation rule

`GAEP-BASE-READY-REQ-010` requires the migration plan to address identity and state transformation. To support that requirement, this candidate record shape treats mechanical rename as insufficient and proposes identifying:

- exact legacy Resource Revision or qualified digest and original Product-Initiative identifier;
- whether the source represents a durable Product, bounded work, or an inseparable combination;
- proposed Product Managed Asset identity, or an explicit retained-legacy/not-applicable disposition, plus zero or more bounded Initiative identities;
- exact `targets`, `governed-by-initiative`, `contributes-to-change`, predecessor, successor, representation, and historical-alias relationships, with a Work Item's Initiative derived through its exactly one Change;
- lifecycle/state mapping with omissions, splits, merges, unsupported values, and uncertainty;
- affected Profiles, baselines, schemas, queries, links, claims, decisions, approvals, and external consumers;
- transformation method, actor, evidence, validation, loss assessment, rollback, and invalidation triggers;
- unresolved conflicts requiring human decision rather than inferred defaults.

Every derived Product and Initiative receives a distinct candidate identity. The original legacy identifier remains attached to the source record and may be referenced as a historical alias only with explicit context; it is never silently reused as the canonical identity of both a Product and an Initiative.

### Proposed rehearsal mapping dispositions

These labels support paper and reversible rehearsal evidence only. They are not approved canonical registry values or migration Decisions.

| Proposed disposition | Meaning | Required evidence or stop |
|---|---|---|
| `one-product-one-initiative` | One durable Product and one bounded Initiative can be reconstructed with attributable identity, relationship, and state evidence. | Record both identities, `targets`, source revision, transformation, and round-trip/historical interpretation. |
| `one-product-many-initiatives` | One Product and several historically distinct bounded Initiatives can be reconstructed. | Every Initiative boundary, ordering or overlap, target, and supporting evidence must be explicit; chronology alone is insufficient. |
| `product-only` | A durable Product is supported, but no defensible bounded historical Initiative can be reconstructed. | Preserve the source work history as legacy evidence; do not invent an Initiative. |
| `retained-legacy-only` | The source remains intelligible only under its original semantics. | Exclude it from authoritative candidate transformation and retain an explicit legacy-consumer path. |
| `lossy` | A proposed mapping omits, merges, splits, or changes identity, state, relationship, authority, evidence, or meaning. | Enumerate every loss and consumer consequence; never report the mapping as lossless. |
| `unresolved` | Subject identity, cardinality, state owner, relationship, or transformation cannot be established. | Stop automatic transformation and require attributable human disposition. |
| `not-applicable` | A declared source-target mapping or compatibility dimension genuinely does not apply. | Bind the exact pair and dimension with rationale; do not propagate the result to other dimensions. |

### State ownership and allocation

Legacy Product lifecycle labels cannot be copied into one candidate `status` field. Rehearsal must allocate each observed value and transition as follows:

| Legacy concern | Candidate allocation rule |
|---|---|
| Durable Product existence, operation, evolution, or retirement | Allocate to the Product Managed Asset's applicable lifecycle or operational dimension. Product retirement does not close or erase Initiative history. |
| Bounded discovery, design, implementation, verification, release-preparation, migration, security, or retirement work | Allocate to the applicable Initiative/Profile work state and any distinct Change or Work Item states. Initiative closure does not retire the Product. |
| Legacy `evolving` | Represent Product continuity separately from each active bounded Initiative and Change; do not use one composite value as all three states. |
| Legacy `operational` or `retired` | Attribute the durable-subject condition to Product; record Initiative completion/closure separately when evidence exists. |
| Approval, evidence, validity, baseline, compatibility, and migration status | Preserve as separate records or dimensions; none may be inferred from Product or Initiative lifecycle state. |
| Composite, unsupported, or ambiguous value | Preserve the original value and mark the candidate allocation unresolved or lossy; do not normalize by label similarity. |

Profile applicability is re-evaluated after identity mapping. A Product classification, Product path, Product field, or mapped Product Managed Asset does not by itself activate the Product Development Profile.

### Proposed migration assessment fields

The assessment should not compress assessment coverage, compatibility, mapping fidelity, representation strategy, applicability, and migration decision into one status. `GAEP-STATE-REG-REQ-001`, `GAEP-STATE-REG-REQ-005`, and `GAEP-STATE-REG-REQ-007` keep these meanings separate.

| Field | Proposed representation | Boundary |
|---|---|---|
| Assessment coverage | exact source/target revisions, dimensions assessed, evaluator, method, evidence, time, and unassessed dimensions | Absence of assessment is not incompatibility, compatibility, deferral, or non-applicability. |
| Compatibility result | use `compatible`, `compatible-with-conditions`, `incompatible`, `unknown`, or `not-applicable` separately for every applicable `GAEP-CORE-012` dimension | No aggregate label may hide a failed or unknown material dimension. |
| Mapping fidelity and loss | `not-mapped`, `lossless`, `lossy`, or `unknown`, plus omitted fields, semantics, relationships, states, authority, and consumer consequences | Mapping fidelity is not a compatibility, approval, or migration-decision result. The values are registered as Proposed candidates in `GAEP-REG-007`; no approval is implied. |
| Representation and coexistence | selected `versioned-mapping/staged-dual-read/no-initial-dual-write`, plus exact consumer version, read path, source authority, deprecation, rollback, and exit criteria | Representation strategy does not establish compatibility, mapping fidelity, migration completion, approval, or authorization. |
| Migration decision and permission | reference exact Decision Outcome, Approval Determination, migration subject/plan revision, and Authorization Grant where effectful | `deferred`, `no action`, approval, and authorization remain separate governed records, not compatibility values. |
| Applicability | record the exact source-target pair and dimension for any `not-applicable` result, with rationale | Non-applicability in one dimension does not propagate to another dimension or the migration as a whole. |

Bounded read-only or explicitly reversible rehearsal may produce evidence while `GAEP-DEC-007` effectiveness and downstream approvals remain pending, provided it preserves source authority, labels outputs non-authoritative, records loss and uncertainty, and claims no migration or supersession. Any authoritative or effectful transformation remains blocked until the Decision is effective, the exact migration subject and plan are approved, and the repository change has a separate applicable Authorization Grant.

## Version-bound constitutional supersession package

The selected intent requires a later package with all of the following fields; this map prepares the shape but does not populate an Approval Determination:

- exact legacy Constitution path, Document ID, version, Git source snapshot, file digest, Article and clause text, and clause digest;
- exact candidate Constitution Resource Revision or content digest after the candidate replacement stabilizes;
- exact effective scope, exclusions, effective time, transition period, and review or expiry condition;
- clause-level old-to-new semantic mapping and affected requirement IDs;
- identity, lifecycle, state, Profile, relationship, consumer, compatibility, and historical-interpretation consequences;
- mapping fidelity, known loss, unresolved ambiguity, dissent, independent review, and residual risk;
- rollback, recovery, source retention, redirect, archival, and external-reference treatment;
- Human Principal acting as GAEP Constitutional Owner under an effective Role Assignment and authority source;
- exact Approval Case and version-bound Approval Determination;
- any separate authorized Change required to publish redirects, designate a Baseline Set, or alter active consumer behavior.

The current exact legacy constitutional file and clause digests are recorded above. The exact candidate replacement revision, effective assignment, independent review, Approval Case, Approval Determination, and effective time remain absent. The legacy constitutional corpus therefore remains unchanged and is not superseded.

## Rehearsal rollback, recovery, and stop rules

A non-authoritative rehearsal rolls back by discarding or isolating the derived candidate projection and returning consumer routing to the unchanged legacy representation. The source content, identifiers, source revision, mapping record, loss assessment, rejected mappings, and rehearsal evidence remain retained for historical interpretation and review. Rollback never rewrites the source to resemble the candidate.

The rehearsal or migration analysis stops without inferred defaults when:

- Product or Initiative identity, cardinality, relationship, state owner, authority, or history is ambiguous;
- an invariant cannot be preserved or a moved obligation loses stable trace;
- a target revision is mutable, dirty, missing, or falsely identified by the starting commit;
- mapping loss or a consumer consequence cannot be enumerated;
- a candidate path, field, or classification would be treated as identity proof;
- an edit to the legacy corpus, authoritative write, dual-write, redirect, archive, or removal would be required;
- a mapping would activate a Profile, designate a Candidate Revision Set or Baseline Set, claim gate passage, or imply approval or authorization;
- a participant, external system, executable reference realization, or production environment would be affected.

## Reversible migration rehearsal GAEP-MIG-REH-001

This 2026-07-20 rehearsal applied the proposed transformation and stop rules to synthetic records and the exact legacy clauses already bound above. It changed no legacy file, authoritative record, routing, external system, or production state. After the 2026-07-24 legacy-inventory additions, the normalized migration-map input SHA-256 is `77dde3577eea1265ed949c8cf14e8058b605cde334f3e953cd3959d1c7b4219c`, omitting this rehearsal section while retaining the migration gates; the broader normalized 47-file semantic input aggregate is recorded in `GAEP-PAPER-001` and must be recomputed whenever an included input changes.

| Rehearsal case | Synthetic input | Applied rule | Result | Evidence limitation |
|---|---|---|---|---|
| M01 defensible one-to-one split | one legacy combined record with an exact source digest, durable-subject evidence, one bounded work interval, and attributable target evidence | create distinct non-authoritative Product and Initiative candidate identities, preserve the legacy ID only as a contextual historical alias, and add typed `targets` and `derived-from` relationships | reversible-paper-pass | synthetic evidence does not prove any real legacy record supports the split |
| M02 unsupported one-to-many split | one combined record with several date clusters but no attributable Initiative boundaries | refuse chronology- or folder-based invention and record competing interpretations plus missing evidence | expected-stop-pass; disposition `unresolved` | a human migration Decision is still absent |
| M03 composite lifecycle state | legacy `evolving` value attached to the combined record | preserve the source value; allocate Product continuity and bounded work state only where evidence supports them; enumerate the unallocated remainder | reversible-paper-pass-with-loss; disposition `lossy` | no approved canonical lifecycle mapping exists |
| M04 legacy-only consumer | consumer declares support only for the exact legacy representation | return the unchanged legacy view and withhold unsupported candidate fields | reversible-paper-pass | no real consumer inventory or access path was exercised |
| M05 candidate-only consumer | consumer requests candidate semantics from the versioned derived view | return separate candidate identities, mapping version, source digest, loss, and typed relationships without reusing the combined ID | reversible-paper-pass | derived output remained in this paper record only |
| M06 attempted dual-write | proposed update would mutate both legacy and candidate representations | deny the write because no single-record authority, conflict policy, migration approval, or Authorization Grant exists | expected-denial-pass | no runtime enforcement was tested |
| M07 rollback and reconstruction | discard the synthetic candidate projection after M01–M05 | restore legacy-only routing conceptually; retain source, mapping method, rejected interpretations, loss, and rehearsal result | reversible-paper-pass | rollback is a static walkthrough, not operational recovery evidence |

The rehearsal found no defensible universal mechanical migration. It confirmed that explicit distinct identities, evidence-backed cardinality, state ownership, per-dimension compatibility, staged dual-read, no initial dual-write, and fail-explicit ambiguity are necessary. It also found that the current documentation lacks real record fixtures, consumer inventory, effective migration authority, an exact approved target Candidate Revision Set, a constitutional Approval Determination, and an Authorization Grant. The result therefore supports the shape of the migration contract only; it does not satisfy authoritative migration, rollback, consumer-compatibility, or supersession evidence.

The rehearsal projection was rolled back immediately by retaining it only as the non-authoritative rows above. No generated candidate identity is canonical or reusable. A material change to the source bindings, target semantic snapshot, transformation rules, Decision status, authority assumptions, consumer model, or compatibility contract invalidates this result.

## Migration gates

1. Candidate content and ownership review.
2. Contradiction and semantic-registry closure, including `GAEP-DEC-007` and `GAEP-GAP-050`.
3. Paper reference scenarios, reversible migration rehearsal, and GAEP-on-GAEP manual rehearsal evidence; participant pilot evidence only after separate authorization if a later gate requires it.
4. Metadata, dependency, link and requirement validation.
5. Exact-version approval and named baseline set.
6. Supersession records and redirects.
7. Legacy archival or removal only through a separately approved, recoverable change.
